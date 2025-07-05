'use strict';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = {
  async create(ctx) {
    try {
      const { productId, quantity, userId, cartItems, customer, shippingAddress } = ctx.request.body;

      // Get user information
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
      });

      if (!user) {
        return ctx.badRequest('User not found');
      }

      let lineItems = [];
      let totalAmount = 0;

      if (cartItems) {
        // Handle cart checkout
        for (const item of cartItems) {
          const product = await strapi.entityService.findOne('api::product.product', item.productId, {
            populate: ['imgMain'],
          });

          if (!product) {
            return ctx.badRequest(`Product ${item.productId} not found`);
          }

          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: product.name,
                images: product.imgMain ? [`http://localhost:1337${product.imgMain.url}`] : [],
              },
              unit_amount: Math.round(product.prix * 100), // Convert to cents
            },
            quantity: item.quantity,
          });

          totalAmount += product.prix * item.quantity;
        }
      } else {
        // Handle single product checkout
        const product = await strapi.entityService.findOne('api::product.product', productId, {
          populate: ['imgMain'],
        });

        if (!product) {
          return ctx.badRequest('Product not found');
        }

        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              images: product.imgMain ? [`http://localhost:1337${product.imgMain.url}`] : [],
            },
            unit_amount: Math.round(product.prix * 100), // Convert to cents
          },
          quantity: quantity,
        });

        totalAmount = product.prix * quantity;
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
        customer_email: customer?.email || user.email,
        customer: customer ? {
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address
        } : undefined,
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'FR', 'MA'], // Add more countries as needed
        },
        metadata: {
          userId: userId,
        },
      });

      // Create checkout session record in database
      const checkoutSession = await strapi.entityService.create('api::checkout-session.checkout-session', {
        data: {
          sessionId: session.id,
          status_checkout: 'pending',
          amount: totalAmount,
          currency: 'usd',
          user: userId,
          products: cartItems ? cartItems.map(item => item.productId) : [productId],
          quantities: cartItems ? cartItems.map(item => ({ productId: item.productId, quantity: item.quantity })) : [{ productId, quantity }],
          customer: customer,
          shippingAddress: shippingAddress,
          publishedAt: new Date(),
        },
      });

      // Create order record
      const order = await strapi.entityService.create('api::order.order', {
        data: {
          orderNumber: `ORD-${Date.now()}`,
          statusOrder: 'pending',
          totalAmount: totalAmount,
          currency: 'usd',
          user: userId,
          products: cartItems ? cartItems.map(item => item.productId) : [productId],
          quantities: cartItems ? cartItems.map(item => ({ productId: item.productId, quantity: item.quantity })) : [{ productId, quantity }],
          paymentStatus: 'pending',
          shippingAddress: shippingAddress,
          checkoutSession: checkoutSession.id,
          publishedAt: new Date(),
        },
      });

      return { sessionId: session.id };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return ctx.badRequest('Error creating checkout session');
    }
  },

  async handleWebhook(ctx) {
    const sig = ctx.request.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        ctx.request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Update checkout session status
        await strapi.entityService.update('api::checkout-session.checkout-session', session.id, {
          data: {
            status_checkout: 'completed',
          },
        });

        // Update order status
        const order = await strapi.entityService.findMany('api::order.order', {
          filters: {
            checkoutSession: {
              sessionId: session.id,
            },
          },
        });

        if (order && order.length > 0) {
          await strapi.entityService.update('api::order.order', order[0].id, {
            data: {
              status_checkout: 'processing',
              paymentStatus: 'paid',
            },
          });

          // Update product stock
          const checkoutSession = await strapi.entityService.findOne('api::checkout-session.checkout-session', session.id, {
            populate: ['products'],
          });

          for (const item of checkoutSession.quantities) {
            const product = await strapi.entityService.findOne('api::product.product', item.productId);
            if (product) {
              await strapi.entityService.update('api::product.product', item.productId, {
                data: {
                  stock: product.stock - item.quantity,
                },
              });
            }
          }
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;

        // Update checkout session status
        await strapi.entityService.update('api::checkout-session.checkout-session', session.id, {
          data: {
            status_checkout: 'failed',
          },
        });

        // Update order status
        const order = await strapi.entityService.findMany('api::order.order', {
          filters: {
            checkoutSession: {
              sessionId: session.id,
            },
          },
        });

        if (order && order.length > 0) {
          await strapi.entityService.update('api::order.order', order[0].id, {
            data: {
              status_checkout: 'cancelled',
              paymentStatus: 'failed',
            },
          });
        }
        break;
      }
    }

    return { received: true };
  },
}; 