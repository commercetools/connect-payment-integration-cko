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
 * Get JWT token for API authentication
 */
export const getJwtToken = async () => {
  const response = await fetch("http://localhost:9002/jwt/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      iss: "https://issuer.com",
      sub: "test-sub",
      "https://issuer.com/claims/project_key": `${window.__VITE_CTP_PROJECT_KEY__}`,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get JWT token");
  }

  const data = await response.json();
  return data.token;
};

/**
 * Ensure project has required currencies and countries configured
 */
export const ensureProjectConfiguration = async () => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const requiredCurrencies = ["EUR", "USD", "GBP", "DKK", "NOK", "SEK", "PLN", "CHF", "AUD"];
  const requiredCountries = [
    "AU",
    "AT",
    "BE",
    "DK",
    "FI",
    "FR",
    "DE",
    "IT",
    "NL",
    "NO",
    "PL",
    "PT",
    "ES",
    "SE",
    "CH",
    "GB",
    "US",
  ];

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

  // Tax rates for all countries
  const taxRates = {
    AU: 0.1, // Australia 10% GST
    AT: 0.2, // Austria 20%
    BE: 0.21, // Belgium 21%
    DK: 0.25, // Denmark 25%
    FI: 0.24, // Finland 24%
    FR: 0.2, // France 20%
    DE: 0.19, // Germany 19%
    IT: 0.22, // Italy 22%
    NL: 0.21, // Netherlands 21%
    NO: 0.25, // Norway 25%
    PL: 0.23, // Poland 23%
    PT: 0.23, // Portugal 23%
    ES: 0.21, // Spain 21%
    SE: 0.25, // Sweden 25%
    CH: 0.077, // Switzerland 7.7%
    GB: 0.2, // UK 20%
    US: 0.08, // US 8% (varies by state)
  };

  // Try to get existing tax category
  const searchResponse = await fetch(`${apiUrl}/${projectKey}/tax-categories?where=key="commercestore-standard-tax"`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (searchResponse.ok) {
    const data = await searchResponse.json();
    if (data.results.length > 0) {
      const taxCategory = data.results[0];

      // Check if country rate already exists
      const hasCountryRate = taxCategory.rates.some((r) => r.country === country);

      if (hasCountryRate) {
        return taxCategory;
      }

      // Need to add rate for this country
      const taxRate = taxRates[country];
      if (taxRate !== undefined) {
        console.log(`Adding tax rate for country ${country} (${taxRate * 100}%)`);

        try {
          const updateResponse = await fetch(`${apiUrl}/${projectKey}/tax-categories/${taxCategory.id}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              version: taxCategory.version,
              actions: [
                {
                  action: "addTaxRate",
                  taxRate: {
                    name: "Standard",
                    amount: taxRate,
                    includedInPrice: false,
                    country: country,
                  },
                },
              ],
            }),
          });

          if (updateResponse.ok) {
            console.log(`✓ Added tax rate for ${country}`);
            return await updateResponse.json();
          } else {
            const error = await updateResponse.json();
            console.warn(`Could not add tax rate for ${country}:`, error.message);
            return taxCategory;
          }
        } catch (error) {
          console.warn(`Could not add tax rate for ${country}:`, error.message);
          return taxCategory;
        }
      }

      return taxCategory;
    }
  }

  // Create tax category with rates for all countries
  const createResponse = await fetch(`${apiUrl}/${projectKey}/tax-categories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "commercestore - Standard Tax",
      key: "commercestore-standard-tax",
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
    `${apiUrl}/${projectKey}/shipping-methods?where=key="commercestore-standard-shipping"`,
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

      // Check if zone exists in shipping method
      const existingZoneRate = shippingMethod.zoneRates.find((zr) => zr.zone.id === zone.id);

      // Check if we have the specific currency we need
      const hasRequiredCurrency = existingZoneRate
        ? existingZoneRate.shippingRates.some((sr) => sr.price.currencyCode === currency)
        : false;

      if (hasRequiredCurrency) {
        console.log(`✓ Shipping method already has rate for zone ${zone.name} and currency ${currency}`);
        return shippingMethod;
      }

      // Need to add zone rate for this zone/currency combination
      console.log(`Checking shipping rates for zone ${zone.name}...`);

      const shippingPrices = {
        EUR: 500, // €5.00
        USD: 600, // $6.00
        GBP: 400, // £4.00
        DKK: 4000, // 40 DKK
        NOK: 5000, // 50 NOK
        SEK: 5000, // 50 SEK
        PLN: 2000, // 20 PLN
        CHF: 500, // 5 CHF
        AUD: 800, // $8.00 AUD
      };

      try {
        const zoneAlreadyAdded = !!existingZoneRate;

        const actions = [];

        // Only add zone if it's not already there
        if (!zoneAlreadyAdded) {
          console.log(`Zone ${zone.name} not in shipping method, adding it...`);
          actions.push({
            action: "addZone",
            zone: {
              typeId: "zone",
              id: zone.id,
            },
          });
        }

        // Add shipping rates for ALL currencies that are missing
        const existingCurrencies = existingZoneRate
          ? existingZoneRate.shippingRates.map((sr) => sr.price.currencyCode)
          : [];

        const missingCurrencies = [];
        Object.entries(shippingPrices).forEach(([currencyCode, centAmount]) => {
          if (!existingCurrencies.includes(currencyCode)) {
            missingCurrencies.push(currencyCode);
            actions.push({
              action: "addShippingRate",
              zone: {
                typeId: "zone",
                id: zone.id,
              },
              shippingRate: {
                price: {
                  currencyCode,
                  centAmount,
                },
              },
            });
          }
        });

        if (missingCurrencies.length > 0) {
          console.log(`Missing currencies for zone ${zone.name}: ${missingCurrencies.join(", ")}`);
        }

        if (actions.length === 0) {
          console.log(`✓ Zone ${zone.name} already has all required shipping rates`);
          return shippingMethod;
        }

        const updateResponse = await fetch(`${apiUrl}/${projectKey}/shipping-methods/${shippingMethod.id}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: shippingMethod.version,
            actions: actions,
          }),
        });

        if (updateResponse.ok) {
          const updatedMethod = await updateResponse.json();
          console.log(`✓ Successfully updated shipping method with ${missingCurrencies.length} new rate(s)`);
          return updatedMethod;
        } else {
          const error = await updateResponse.json();
          console.error("Failed to update shipping method:", error);
          throw new Error(error.message || "Failed to add shipping rates to shipping method");
        }
      } catch (error) {
        console.error("Error updating shipping method:", error);
        throw error;
      }
    }
  }

  // Get tax category first
  const taxCategory = await getOrCreateTaxCategory(country);

  // Get or create zone
  const zone = await getOrCreateZone(country);

  // Create shipping method with all supported currencies
  const shippingPrices = {
    EUR: 500, // €5.00
    USD: 600, // $6.00
    GBP: 400, // £4.00
    DKK: 4000, // 40 DKK
    NOK: 5000, // 50 NOK
    SEK: 5000, // 50 SEK
    PLN: 2000, // 20 PLN
    CHF: 500, // 5 CHF
    AUD: 800, // $8.00 AUD
  };

  const createResponse = await fetch(`${apiUrl}/${projectKey}/shipping-methods`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "commercestore - Standard Shipping",
      key: "commercestore-standard-shipping",
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

  const supportedCountries = [
    "AU",
    "AT",
    "BE",
    "DK",
    "FI",
    "FR",
    "DE",
    "IT",
    "NL",
    "NO",
    "PL",
    "PT",
    "ES",
    "SE",
    "CH",
    "GB",
    "US",
  ];

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

  // Try to get our specific commercestore-zone
  const searchResponse = await fetch(`${apiUrl}/${projectKey}/zones?where=key="commercestore-zone"`, {
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
        console.log(`✓ Country ${country} already exists in commercestore-zone`);
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
            console.log(`✓ Added country ${country} to commercestore-zone`);
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
      name: "commercestore - All Countries Zone",
      key: "commercestore-zone",
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

  console.log(`✓ Created new commercestore-zone with country ${country}`);
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
    FI: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Mannerheimintie",
      streetNumber: "5",
      city: "Helsinki",
      postalCode: "00100",
      country: "FI",
      phone: "+358 9 1234567",
      email: "customer@example.fi",
    },
    NO: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Karl Johans gate",
      streetNumber: "22",
      city: "Oslo",
      postalCode: "0162",
      country: "NO",
      phone: "+47 22 123456",
      email: "customer@example.no",
    },
    SE: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Drottninggatan",
      streetNumber: "50",
      city: "Stockholm",
      postalCode: "111 21",
      country: "SE",
      phone: "+46 8 123 456",
      email: "customer@example.se",
    },
    DK: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Strøget",
      streetNumber: "10",
      city: "Copenhagen",
      postalCode: "1160",
      country: "DK",
      phone: "+45 33 123456",
      email: "customer@example.dk",
    },
    PL: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Marszałkowska",
      streetNumber: "100",
      city: "Warsaw",
      postalCode: "00-026",
      country: "PL",
      phone: "+48 22 123 4567",
      email: "customer@example.pl",
    },
    CH: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Bahnhofstrasse",
      streetNumber: "50",
      city: "Zurich",
      postalCode: "8001",
      country: "CH",
      phone: "+41 44 123 4567",
      email: "customer@example.ch",
    },
    AU: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "George Street",
      streetNumber: "200",
      city: "Sydney",
      state: "NSW",
      postalCode: "2000",
      country: "AU",
      phone: "+61 2 1234 5678",
      email: "customer@example.com.au",
    },
    AT: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Kärntner Straße",
      streetNumber: "10",
      city: "Vienna",
      postalCode: "1010",
      country: "AT",
      phone: "+43 1 123 4567",
      email: "customer@example.at",
    },
    BE: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Rue Neuve",
      streetNumber: "123",
      city: "Brussels",
      postalCode: "1000",
      country: "BE",
      phone: "+32 2 123 4567",
      email: "customer@example.be",
    },
    IT: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Via del Corso",
      streetNumber: "100",
      city: "Rome",
      postalCode: "00186",
      country: "IT",
      phone: "+39 06 1234 5678",
      email: "customer@example.it",
    },
    PT: {
      firstName: customerName.firstName,
      lastName: customerName.lastName,
      streetName: "Avenida da Liberdade",
      streetNumber: "200",
      city: "Lisbon",
      postalCode: "1250-096",
      country: "PT",
      phone: "+351 21 123 4567",
      email: "customer@example.pt",
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
        key: "commercestore-cart-type",
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
    // Use different email per country for demo purposes
    const customerData = {
      AU: { email: "customer-au@example.com", firstName: "Olivia", lastName: "Smith" },
      AT: { email: "customer-at@example.com", firstName: "Anna", lastName: "Müller" },
      BE: { email: "customer-be@example.com", firstName: "Sophie", lastName: "Dubois" },
      CH: { email: "customer-ch@example.com", firstName: "Emma", lastName: "Weber" },
      DE: { email: "customer-de@example.com", firstName: "Emma", lastName: "Schmidt" },
      DK: { email: "customer-dk@example.com", firstName: "Emma", lastName: "Jensen" },
      ES: { email: "customer-es@example.com", firstName: "Sofía", lastName: "García" },
      FI: { email: "customer-fi@example.com", firstName: "Sofia", lastName: "Virtanen" },
      FR: { email: "customer-fr@example.com", firstName: "Emma", lastName: "Martin" },
      GB: { email: "customer-gb@example.com", firstName: "Emily", lastName: "Jones" },
      IT: { email: "customer-it@example.com", firstName: "Sofia", lastName: "Rossi" },
      NL: { email: "customer-nl@example.com", firstName: "Emma", lastName: "de Jong" },
      NO: { email: "customer-no@example.com", firstName: "Emma", lastName: "Hansen" },
      PL: { email: "customer-pl@example.com", firstName: "Julia", lastName: "Nowak" },
      PT: { email: "customer-pt@example.com", firstName: "Maria", lastName: "Silva" },
      SE: { email: "customer-se@example.com", firstName: "Emma", lastName: "Andersson" },
      US: { email: "customer-us@example.com", firstName: "Emma", lastName: "Johnson" },
    };

    const demoCustomer = customerData[country] || customerData["US"];

    // Check if customer already exists
    const existingCustomers = await searchCustomerByEmail(demoCustomer.email);

    if (existingCustomers.length > 0) {
      // Use existing customer
      customerId = existingCustomers[0].id;
      console.log(`✓ Using existing demo customer: ${demoCustomer.email}`);
    } else {
      // Create new demo customer
      const customer = await createCustomer(demoCustomer.email, demoCustomer.firstName, demoCustomer.lastName);
      customerId = customer.id;
      console.log(`✓ Created new demo customer: ${demoCustomer.email}`);
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
 * Get customer by ID from commercetools
 */
export const getCustomerById = async (customerId) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const response = await fetch(`${apiUrl}/${projectKey}/customers/${customerId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null; // Return null if customer not found
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
    checkoutTransactionItemId: new Date().getTime().toString(),
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
      "vipps",
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
  const searchResponse = await fetch(`${apiUrl}/${projectKey}/types?where=key="commercestore-cart-type"`, {
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
      key: "commercestore-cart-type",
      name: {
        en: "commercestore - Custom Cart Type",
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

/**
 * Get payment by ID from CommerceTools
 */
export const getPaymentById = async (paymentId) => {
  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  const response = await fetch(`${apiUrl}/${projectKey}/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get payment");
  }

  return await response.json();
};

/**
 * Get all payments from CommerceTools with optional filters
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of results to return (default 50)
 * @param {number} options.offset - Number of results to skip (default 0)
 * @param {string} options.paymentInterface - Filter by payment interface (e.g., 'checkout-cko')
 * @param {string} options.sort - Sort expression (e.g., 'createdAt desc')
 * @returns {Promise<Object>} Payments response with results and total
 */
export const getPayments = async (options = {}) => {
  const {
    limit = 50,
    offset = 0,
    paymentInterface = 'checkout-cko',
    sort = 'createdAt desc',
  } = options;

  const token = await getCtpToken();
  const apiUrl = window.__VITE_CTP_API_URL__;
  const projectKey = window.__VITE_CTP_PROJECT_KEY__;

  // Build where clause - only get payments with transactions AND matching interface
  const whereConditions = [];
  
  if (paymentInterface) {
    whereConditions.push(`paymentMethodInfo(paymentInterface="${paymentInterface}")`);
  }
  
  // Only get payments that have at least one transaction
  whereConditions.push('transactions is not empty');

  // Build query params
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    sort,
  });

  if (whereConditions.length > 0) {
    params.append('where', whereConditions.join(' and '));
  }

  const response = await fetch(`${apiUrl}/${projectKey}/payments?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get payments");
  }

  return await response.json();
};

/**
 * Execute action on a payment via payment-intents API
 * @param {string} paymentId - Payment ID
 * @param {Object} actionData - Action data (action type and optional amount)
 * @returns {Promise<Object>} Updated payment
 */
export const executePaymentAction = async (paymentId, actionData) => {
  const processorUrl = window.__VITE_PROCESSOR_URL__;
  const token = await getCtpToken();

  const response = await fetch(`${processorUrl}/operations/payment-intents/${paymentId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(actionData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to execute ${actionData.action}`);
  }

  return await response.json();
};
