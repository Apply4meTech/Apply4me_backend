const axios = require('axios');

// Get address autocomplete suggestions using Places API (New)
const getAddressSuggestions = async (req, res) => {
  try {
    const { input } = req.query;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Google Places API key not configured'
      });
    }

    if (!input || input.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Input must be at least 2 characters'
      });
    }

    // Use Places API (New) Autocomplete endpoint
    const url = 'https://places.googleapis.com/v1/places:autocomplete';

    const response = await axios.post(
      url,
      {
        input: input.trim(),
        includedRegionCodes: ['AU'], // Restrict to Australia
        // Omit includedPrimaryTypes: street_address/premise are Table B and
        // can reject Autocomplete (New) requests; AU region is enough scope.
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.place,suggestions.placePrediction.text',
        },
      }
    );

    const suggestions = response.data.suggestions || [];

    res.json({
      success: true,
      suggestions: suggestions
        .map((suggestion) => {
          const prediction = suggestion.placePrediction || {};
          // Places API (New) may return placeId or full resource name "places/ChIJ..."
          const rawId = prediction.placeId || prediction.place || '';
          const placeId = String(rawId).replace(/^places\//, '');
          return {
            placeId,
            description: prediction.text?.text || '',
            structuredFormat: prediction.structuredFormat,
          };
        })
        .filter((s) => s.placeId && s.description),
    });
  } catch (error) {
    console.error('Error fetching address suggestions:', error.response?.data || error.message);
    const status = error.response?.status === 403 ? 503 : 500;
    res.status(status).json({
      success: false,
      error: 'Failed to fetch address suggestions',
      details: error.response?.data?.error?.message || error.message,
    });
  }
};

// Get place details using Places API (New)
const getPlaceDetails = async (req, res) => {
  try {
    const { placeId } = req.query;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Google Places API key not configured'
      });
    }

    if (!placeId) {
      return res.status(400).json({
        success: false,
        error: 'Place ID is required'
      });
    }

    const normalizedPlaceId = String(placeId).replace(/^places\//, '');

    // Use Places API (New) Place Details endpoint
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedPlaceId)}`;

    const response = await axios.get(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,formattedAddress,addressComponents'
      }
    });

    const place = response.data;

    // Parse address components
    const addressComponents = place.addressComponents || [];
    let houseNumber = '';
    let streetName = '';
    let suburb = '';
    let state = '';
    let postcode = '';

    addressComponents.forEach((component) => {
      const types = component.types || [];

      if (types.includes('street_number')) {
        houseNumber = component.longText || component.shortText || '';
      } else if (types.includes('route')) {
        streetName = component.longText || component.shortText || '';
      } else if (
        types.includes('locality') ||
        types.includes('sublocality') ||
        types.includes('sublocality_level_1')
      ) {
        if (!suburb) suburb = component.longText || component.shortText || '';
      } else if (types.includes('administrative_area_level_1')) {
        state = component.shortText || component.longText || '';
      } else if (types.includes('postal_code')) {
        postcode = component.longText || component.shortText || '';
      }
    });

    res.json({
      success: true,
      place: {
        placeId: place.id,
        formattedAddress: place.formattedAddress || '',
        addressComponents: {
          houseNumber,
          streetName,
          suburb,
          state,
          postcode
        }
      }
    });
  } catch (error) {
    console.error('Error fetching place details:', error.response?.data || error.message);
    const status = error.response?.status === 403 ? 503 : 500;
    res.status(status).json({
      success: false,
      error: 'Failed to fetch place details',
      details: error.response?.data?.error?.message || error.message
    });
  }
};

module.exports = {
  getAddressSuggestions,
  getPlaceDetails
};

