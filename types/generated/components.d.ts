import type { Schema, Struct } from '@strapi/strapi';

export interface AddressLine1ComponentsAddressAddresses
  extends Struct.ComponentSchema {
  collectionName: 'components_address_line1_components_address_addresses';
  info: {
    displayName: 'components_address_addresses';
    icon: 'pinMap';
  };
  attributes: {
    addressLine1: Schema.Attribute.String;
    addressLine2: Schema.Attribute.String;
    city: Schema.Attribute.String;
    country: Schema.Attribute.String;
    isDefault: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    postalCode: Schema.Attribute.String;
  };
}

export interface AddressLine1ComponentsProductDimensions
  extends Struct.ComponentSchema {
  collectionName: 'components_address_line1_components_product_dimensions';
  info: {
    description: '';
    displayName: 'components_product_dimensions';
  };
  attributes: {
    height: Schema.Attribute.Decimal;
    length: Schema.Attribute.Decimal;
    unit: Schema.Attribute.Enumeration<['ft', 'in', 'm', 'cm', 'mm']> &
      Schema.Attribute.DefaultTo<'cm'>;
    width: Schema.Attribute.Decimal;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'address-line1.components-address-addresses': AddressLine1ComponentsAddressAddresses;
      'address-line1.components-product-dimensions': AddressLine1ComponentsProductDimensions;
    }
  }
}
