/**
 * Get OAuth token from commercetools
 */
export const getCtpToken = async () => {
  const authUrl = window.__VITE_CTP_AUTH_URL__;
  const clientId = window.__VITE_CTP_CLIENT_ID__;
  const clientSecret = window.__VITE_CTP_CLIENT_SECRET__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const response = await fetch(
    `${authUrl}/oauth/token?grant_type=client_credentials&scope=manage_project:${projectKey}`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get OAuth token");
  }

  const data = await response.json();
  return data.access_token;
};

/**
 * Ensure project has required currencies and countries configured
 */
export const ensureProjectConfiguration = async () => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const requiredCurrencies = ["EUR", "USD", "GBP"];
  const requiredCountries = ["DE", "NL", "ES", "US", "GB", "FR"];

  // Get current project settings
  const projectResponse = await fetch(`${apiUrl}/${projectKey}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!projectResponse.ok) {
    throw new Error("Failed to get project settings");
  }

  const project = await projectResponse.json();
  const currentCurrencies = project.currencies || [];
  const currentCountries = project.countries || [];

  // Check if we need to add anything
  const missingCurrencies = requiredCurrencies.filter((c) => !currentCurrencies.includes(c));
  const missingCountries = requiredCountries.filter((c) => !currentCountries.includes(c));

  if (missingCurrencies.length === 0 && missingCountries.length === 0) {
    console.log("✓ Project already has all required currencies and countries");
    return;
  }

  // Update project with missing currencies and countries
  const actions = [];

  if (missingCurrencies.length > 0) {
    actions.push({
      action: "changeCurrencies",
      currencies: [...new Set([...currentCurrencies, ...missingCurrencies])],
    });
    console.log(`Adding missing currencies: ${missingCurrencies.join(", ")}`);
  }

  if (missingCountries.length > 0) {
    actions.push({
      action: "changeCountries",
      countries: [...new Set([...currentCountries, ...missingCountries])],
    });
    console.log(`Adding missing countries: ${missingCountries.join(", ")}`);
  }

  const updateResponse = await fetch(`${apiUrl}/${projectKey}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: project.version,
      actions: actions,
    }),
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.json();
    console.error("Failed to update project settings:", error);
    console.warn("⚠ Could not add missing currencies/countries. Please add them manually in Merchant Center.");
  } else {
    console.log("✓ Successfully added missing currencies and countries to project");
  }
};

/**
 * Get or create a default tax category
 */
const getOrCreateTaxCategory = async (country) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  // Try to get existing tax category
  const searchResponse = await fetch(`${apiUrl}/${projectKey}/tax-categories?where=key="demo-store-standard-tax"`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (searchResponse.ok) {
    const data = await searchResponse.json();
    if (data.results.length > 0) {
      return data.results[0];
    }
  }

  // Create tax category with rates for all countries
  const taxRates = {
    DE: 0.19, // Germany 19%
    NL: 0.21, // Netherlands 21%
    ES: 0.21, // Spain 21%
    US: 0.08, // US (example) 8%
    GB: 0.2, // UK 20%
    FR: 0.2, // France 20%
  };

  const createResponse = await fetch(`${apiUrl}/${projectKey}/tax-categories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Demo Store - Standard Tax",
      key: "demo-store-standard-tax",
      rates: Object.entries(taxRates).map(([country, rate]) => ({
        name: "Standard",
        amount: rate,
        includedInPrice: false,
        country: country,
      })),
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(error.message || "Failed to create tax category");
  }

  return await createResponse.json();
};

/**
 * Get or create a default shipping method
 */
const getOrCreateShippingMethod = async (country, currency) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  // Try to get existing shipping method
  const searchResponse = await fetch(
    `${apiUrl}/${projectKey}/shipping-methods?where=key="demo-store-standard-shipping"`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (searchResponse.ok) {
    const data = await searchResponse.json();
    if (data.results.length > 0) {
      const shippingMethod = data.results[0];

      // Get or create zone for this country
      const zone = await getOrCreateZone(country);

      // Check if shipping method has a rate for this zone and currency
      const hasZoneRate = shippingMethod.zoneRates.some((zr) => {
        if (zr.zone.id !== zone.id) return false;
        return zr.shippingRates.some((sr) => sr.price.currencyCode === currency);
      });

      if (hasZoneRate) {
        console.log(`✓ Shipping method already has rate for zone ${zone.name} and currency ${currency}`);
        return shippingMethod;
      }

      // Need to add zone rate for this zone/currency combination
      console.log(`Adding shipping rate for zone ${zone.name} and currency ${currency}`);

      const shippingPrices = {
        EUR: 500, // 5 EUR
        USD: 600, // 6 USD
        GBP: 400, // 4 GBP
      };

      try {
        const updateResponse = await fetch(`${apiUrl}/${projectKey}/shipping-methods/${shippingMethod.id}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: shippingMethod.version,
            actions: [
              {
                action: "addZone",
                zone: {
                  typeId: "zone",
                  id: zone.id,
                },
              },
              {
                action: "addShippingRate",
                zone: {
                  typeId: "zone",
                  id: zone.id,
                },
                shippingRate: {
                  price: {
                    currencyCode: currency,
                    centAmount: shippingPrices[currency] || 500,
                  },
                },
              },
            ],
          }),
        });

        if (updateResponse.ok) {
          return await updateResponse.json();
        } else {
          const error = await updateResponse.json();
          console.warn("Could not update shipping method:", error.message);
          // Return existing shipping method anyway
          return shippingMethod;
        }
      } catch (error) {
        console.warn("Could not update shipping method:", error.message);
        return shippingMethod;
      }
    }
  }

  // Get tax category first
  const taxCategory = await getOrCreateTaxCategory(country);

  // Get or create zone
  const zone = await getOrCreateZone(country);

  // Create shipping method with all supported currencies
  const shippingPrices = {
    EUR: 500, // 5 EUR
    USD: 600, // 6 USD
    GBP: 400, // 4 GBP
  };

  const createResponse = await fetch(`${apiUrl}/${projectKey}/shipping-methods`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Demo Store - Standard Shipping",
      key: "demo-store-standard-shipping",
      taxCategory: {
        typeId: "tax-category",
        id: taxCategory.id,
      },
      zoneRates: [
        {
          zone: {
            typeId: "zone",
            id: zone.id,
          },
          shippingRates: Object.entries(shippingPrices).map(([currencyCode, centAmount]) => ({
            price: {
              currencyCode,
              centAmount,
            },
          })),
        },
      ],
      isDefault: false,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(error.message || "Failed to create shipping method");
  }

  console.log(`✓ Created shipping method with rates for all currencies`);
  return await createResponse.json();
};

/**
 * Get or create a zone for countries
 */
const getOrCreateZone = async (country) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const supportedCountries = ["DE", "NL", "ES", "US", "GB", "FR"];

  // First, search for ANY zone that already contains this country
  const allZonesResponse = await fetch(`${apiUrl}/${projectKey}/zones`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (allZonesResponse.ok) {
    const allZonesData = await allZonesResponse.json();

    // Check if any zone already contains this country
    const existingZoneWithCountry = allZonesData.results.find((zone) =>
      zone.locations.some((loc) => loc.country === country)
    );

    if (existingZoneWithCountry) {
      console.log(`✓ Country ${country} already exists in zone: ${existingZoneWithCountry.name}`);
      return existingZoneWithCountry;
    }
  }

  // Try to get our specific demo-store-zone
  const searchResponse = await fetch(`${apiUrl}/${projectKey}/zones?where=key="demo-store-zone"`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (searchResponse.ok) {
    const data = await searchResponse.json();
    if (data.results.length > 0) {
      const zone = data.results[0];

      // Check if country is already in our zone
      const countryExists = zone.locations.some((loc) => loc.country === country);

      if (countryExists) {
        console.log(`✓ Country ${country} already exists in demo-store-zone`);
        return zone;
      }

      // Try to add country to our zone only if it's supported and not in any other zone
      if (supportedCountries.includes(country)) {
        try {
          const updateResponse = await fetch(`${apiUrl}/${projectKey}/zones/${zone.id}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              version: zone.version,
              actions: [
                {
                  action: "addLocation",
                  location: { country },
                },
              ],
            }),
          });

          if (updateResponse.ok) {
            console.log(`✓ Added country ${country} to demo-store-zone`);
            return await updateResponse.json();
          } else {
            const error = await updateResponse.json();
            console.warn(`Could not add country ${country} to zone:`, error.message);
            // Return the zone anyway, it's still usable
            return zone;
          }
        } catch (error) {
          console.warn(`Could not add country ${country} to zone:`, error.message);
          return zone;
        }
      }

      return zone;
    }
  }

  // Create zone with initial country only if country is not in any other zone
  const createResponse = await fetch(`${apiUrl}/${projectKey}/zones`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Demo Store - All Countries Zone",
      key: "demo-store-zone",
      locations: [{ country }],
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();

    // If zone creation fails, try to find and use any existing zone
    if (allZonesResponse.ok) {
      const allZonesData = await allZonesResponse.json();
      if (allZonesData.results.length > 0) {
        console.warn(`Using first available zone as fallback: ${allZonesData.results[0].name}`);
        return allZonesData.results[0];
      }
    }

    throw new Error(error.message || "Failed to create zone");
  }

  console.log(`✓ Created new demo-store-zone with country ${country}`);
  return await createResponse.json();
};

/**
 * Get realistic address data by country
 */
const getAddressDataByCountry = (country, customerName = { firstName: "John", lastName: "Doe" }) => {
  const addressData = {
    DE: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Hauptstraße",
      streetNumber: "123",
      city: "Berlin",
      postalCode: "10115",
      country: "DE",
      phone: "+49 30 12345678",
      email: "customer@example.de",
    },
    NL: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Kalverstraat",
      streetNumber: "45",
      city: "Amsterdam",
      postalCode: "1012 NZ",
      country: "NL",
      phone: "+31 20 1234567",
      email: "customer@example.nl",
    },
    ES: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Gran Vía",
      streetNumber: "28",
      city: "Madrid",
      postalCode: "28013",
      country: "ES",
      phone: "+34 91 123 4567",
      email: "customer@example.es",
    },
    US: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Broadway",
      streetNumber: "1500",
      city: "New York",
      state: "NY",
      postalCode: "10036",
      country: "US",
      phone: "+1 212 555 0123",
      email: "customer@example.com",
    },
    GB: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Oxford Street",
      streetNumber: "100",
      city: "London",
      postalCode: "W1D 1LL",
      country: "GB",
      phone: "+44 20 1234 5678",
      email: "customer@example.co.uk",
    },
    FR: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Champs-Élysées",
      streetNumber: "75",
      city: "Paris",
      postalCode: "75008",
      country: "FR",
      phone: "+33 1 23 45 67 89",
      email: "customer@example.fr",
    },
  };

  return addressData[country] || addressData["US"];
};

/**
 * Create a cart with custom line items and proper tax configuration
 */
export const createCart = async ({ currency, country, customerId, customLineItems = [] }) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  // Get custom type for store key
  const customType = await getOrCreateCartStoreType();

  // Get tax category and shipping method
  const taxCategory = await getOrCreateTaxCategory(country);
  const shippingMethod = await getOrCreateShippingMethod(country, currency);

  // Get tax rate for country
  const taxRate = taxCategory.rates.find((r) => r.country === country);
  const taxAmount = taxRate ? taxRate.amount : 0;

  // Process custom line items with proper tax
  const processedLineItems = customLineItems.map((item) => {
    const netAmount = item.money.centAmount;
    const taxAmountCents = Math.round(netAmount * taxAmount);
    const grossAmount = netAmount + taxAmountCents;

    return {
      ...item,
      taxCategory: {
        typeId: "tax-category",
        id: taxCategory.id,
      },
      externalTaxRate: {
        name: "Standard",
        amount: taxAmount,
        country: country,
        includedInPrice: false,
      },
    };
  });

  // Get realistic address data
  const addressData = getAddressDataByCountry(country);

  // Generate storeKey based on country
  const storeKey = `store-${country.toLowerCase()}`;

  const cartDraft = {
    currency,
    country,
    taxMode: "External",
    taxRoundingMode: "HalfEven",
    taxCalculationMode: "LineItemLevel",
    ...(customerId && { customerId }),
    shippingAddress: addressData,
    billingAddress: addressData,
    ...(processedLineItems.length > 0 && { customLineItems: processedLineItems }),
    // Add custom field for store key
    custom: {
      type: {
        typeId: "type",
        key: "demo-store-cart-type",
      },
      fields: {
        storeKey: storeKey,
      },
    },
  };

  // Create cart
  const createResponse = await fetch(`${apiUrl}/${projectKey}/carts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cartDraft),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(error.message || "Failed to create cart");
  }

  let cart = await createResponse.json();

  console.log(`✓ Cart created with storeKey: ${storeKey}`);

  // Add shipping method to cart
  const updateResponse = await fetch(`${apiUrl}/${projectKey}/carts/${cart.id}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: cart.version,
      actions: [
        {
          action: "setShippingMethod",
          shippingMethod: {
            typeId: "shipping-method",
            id: shippingMethod.id,
          },
        },
      ],
    }),
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.json();
    console.warn("Failed to add shipping method:", error);
  } else {
    cart = await updateResponse.json();
  }

  return cart;
};

/**
 * Create a preconfigured cart
 */
export const createPreconfiguredCart = async (config) => {
  const { currency, country, withCustomer } = config;

  let customerId = null;

  if (withCustomer) {
    // Use a fixed email for demo purposes so saved payment methods persist
    const demoEmail = "demo-customer@example.com";

    // Check if customer already exists
    const existingCustomers = await searchCustomerByEmail(demoEmail);

    if (existingCustomers.length > 0) {
      // Use existing customer
      customerId = existingCustomers[0].id;
      console.log(`✓ Using existing demo customer: ${demoEmail}`);
    } else {
      // Create new demo customer
      const customer = await createCustomer(demoEmail, "Demo", "Customer");
      customerId = customer.id;
      console.log(`✓ Created new demo customer: ${demoEmail}`);
    }
  }

  // Create custom line items with realistic product names
  const customLineItems = [
    {
      name: {
        en: "Premium Wireless Headphones",
        de: "Premium Kabellose Kopfhörer",
        es: "Auriculares Inalámbricos Premium",
        fr: "Casque Sans Fil Premium",
        nl: "Premium Draadloze Hoofdtelefoon",
      },
      quantity: 1,
      money: {
        currencyCode: currency,
        centAmount: 12999, // 129.99 in currency
      },
      slug: "premium-wireless-headphones",
    },
    {
      name: {
        en: "Organic Cotton T-Shirt - Navy Blue",
        de: "Bio-Baumwolle T-Shirt - Marineblau",
        es: "Camiseta de Algodón Orgánico - Azul Marino",
        fr: "T-Shirt en Coton Bio - Bleu Marine",
        nl: "Biologisch Katoenen T-Shirt - Marineblauw",
      },
      quantity: 2,
      money: {
        currencyCode: currency,
        centAmount: 3499, // 34.99 in currency
      },
      slug: "organic-cotton-tshirt-navy",
    },
  ];

  return await createCart({
    currency,
    country,
    customerId,
    customLineItems,
  });
};

/**
 * Search for existing customers by email
 */
export const searchCustomerByEmail = async (email) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const response = await fetch(`${apiUrl}/${projectKey}/customers?where=email="${encodeURIComponent(email)}"`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to search customer");
  }

  const data = await response.json();
  return data.results;
};

/**
 * Get cart by ID
 */
export const getCartById = async (cartId) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const response = await fetch(`${apiUrl}/${projectKey}/carts/${cartId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get cart");
  }

  return await response.json();
};

/**
 * Create a new customer in commercetools
 */
export const createCustomer = async (email, firstName, lastName) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const response = await fetch(`${apiUrl}/${projectKey}/customers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      firstName,
      lastName,
      password: "Test1234!",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create customer");
  }

  const data = await response.json();
  return data.customer;
};

/**
 * Create a payment session for a cart
 * @param {string} cartId - The cart ID
 * @returns {Promise<string>} The session ID
 */
export const getSessionId = async (cartId) => {
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;
  const oAuthToken = await getCtpToken();

  const sessionMetadata = {
    processorUrl: window.__VITE_PROCESSOR_URL__,
    paymentInterface: "cko-test",
    allowedPaymentMethods: [
      "ach",
      "alma",
      "applepay",
      "bizum",
      "card",
      "eps",
      "googlepay",
      "ideal",
      "klarna",
      "mbway",
      "paypal",
      "przelewy24",
      "sepa",
    ],
  };

  const url = `${window.__VITE_CTP_SESSION_URL__}/${projectKey}/sessions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oAuthToken}`,
    },
    body: JSON.stringify({
      cart: {
        cartRef: {
          id: cartId,
        },
      },
      metadata: sessionMetadata,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Not able to create session:", url, data);
    throw new Error("Not able to create session");
  }

  console.log("Session created:", data);
  return data.id;
};

/**
 * Get or create a custom type for cart store configuration
 */
const getOrCreateCartStoreType = async () => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  // Try to get existing type
  const searchResponse = await fetch(`${apiUrl}/${projectKey}/types?where=key="demo-store-cart-type"`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (searchResponse.ok) {
    const data = await searchResponse.json();
    if (data.results.length > 0) {
      console.log("✓ Custom type already exists");
      return data.results[0];
    }
  }

  // Create custom type
  const createResponse = await fetch(`${apiUrl}/${projectKey}/types`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: "demo-store-cart-type",
      name: {
        en: "Demo Store - Custom Cart Type",
      },
      resourceTypeIds: ["order"],
      fieldDefinitions: [
        {
          name: "storeKey",
          required: false,
          label: {
            en: "Store Key",
          },
          type: {
            name: "String",
          },
          inputHint: "SingleLine",
        },
      ],
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(error.message || "Failed to create custom type");
  }

  console.log("✓ Created custom type for cart store key");
  return await createResponse.json();
};
