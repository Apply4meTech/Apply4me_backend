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
        includedPrimaryTypes: ['street_address', 'premise']
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text'
        }
      }
    );

    const suggestions = response.data.suggestions || [];
    
    res.json({
      success: true,
      suggestions: suggestions.map(suggestion => ({
        placeId: suggestion.placePrediction?.placeId,
        description: suggestion.placePrediction?.text?.text || '',
        structuredFormat: suggestion.placePrediction?.structuredFormat
      }))
    });
  } catch (error) {
    console.error('Error fetching address suggestions:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch address suggestions',
      details: error.response?.data?.error?.message || error.message
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

    // Use Places API (New) Place Details endpoint
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    
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
      } else if (types.includes('locality') || types.includes('sublocality')) {
        suburb = component.longText || component.shortText || '';
      } else if (types.includes('administrative_area_level_1')) {
        state = component.longText || component.shortText || '';
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
    res.status(500).json({
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

