'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/checkout-sessions',
      handler: 'checkout-session.create',
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/checkout-sessions/webhook',
      handler: 'checkout-session.handleWebhook',
      config: {
        policies: [],
        auth: false,
      },
    },
  ],
}; 