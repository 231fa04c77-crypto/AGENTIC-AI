// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Geocode an address using backend proxy (no CORS issues)
export const geocodeAddress = async (address, backendUrl) => {
  try {
    if (!backendUrl) {
      throw new Error('Backend URL is required')
    }

    const response = await fetch(
      `${backendUrl}/api/location/geocode?address=${encodeURIComponent(address)}`
    )

    if (!response.ok) {
      throw new Error('Geocoding failed')
    }

    const data = await response.json()

    if (data.success && data.coordinates) {
      return {
        lat: data.coordinates.lat,
        lon: data.coordinates.lon
      }
    }

    return null
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}

// Find nearby hospitals using backend API (real hospitals from OpenStreetMap)
export const findNearbyHospitals = async (lat, lon, radius = 10, backendUrl) => {
  if (!backendUrl) {
    throw new Error('Backend URL is required')
  }

  // Abort after 60 seconds — allows the backend time to try all 3 Overpass endpoints (25s each)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 seconds

  try {
    const response = await fetch(
      `${backendUrl}/api/location/nearby-hospitals?lat=${lat}&lon=${lon}&radius=${radius}`,
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch nearby hospitals (HTTP ${response.status})`)
    }

    const data = await response.json()

    if (data.success && data.hospitals) {
      return data.hospitals
    }

    // Backend returned success:false — surface the reason
    throw new Error(data.message || 'No hospitals found nearby')
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('timeout')
    }
    throw error // let the caller handle it
  }
}

// Get user's current location
// Get user's current location with improved error handling and fallback
export const getUserLocation = () => {
  return new Promise((resolve, reject) => {
    // 1. Check if Geolocation is supported
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by your browser');
      error.code = 'NOT_SUPPORTED';
      reject(error);
      return;
    }

    // 2. Check for Secure Context (Required for Geolocation in modern browsers)
    // Localhost is considered secure, but network IPs (192.168...) require HTTPS
    const isSecure = window.isSecureContext;
    if (!isSecure && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      console.warn('⚠️ Non-secure context detected on non-localhost. Geolocation will likely fail.');
      const error = new Error('Insecure Context: Geolocation requires HTTPS when not on localhost.');
      error.code = 'INSECURE_CONTEXT';
      // We don't reject immediately as some old browsers might still allow it, 
      // but we log it for debugging.
    }

    console.log('🛰️ Attempting to retrieve location...');

    // Options for high accuracy
    const highAccuracyOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 0 // Force fresh location
    };

    // Options for low accuracy (fallback)
    const lowAccuracyOptions = {
      enableHighAccuracy: false,
      timeout: 15000, // 15 seconds
      maximumAge: 60000 // Accept a 1-minute old location
    };

    // Stage 1: Try High Accuracy
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('🎯 High accuracy location retrieved');
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        console.error(`❌ High accuracy failed (Code ${error.code}): ${error.message}`);
        
        // Code 1: Permission Denied - No point in retrying
        if (error.code === 1) {
          reject(error);
          return;
        }

        // Stage 2: Fallback to Low Accuracy (Network/Cell Tower)
        console.log('🔄 Retrying with low accuracy (Network location)...');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ Low accuracy location retrieved');
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude
            });
          },
          (error2) => {
            console.error(`❌ Low accuracy failed (Code ${error2.code}): ${error2.message}`);
            
            // If all browser attempts fail, check if we're on a non-secure context
            if (!isSecure && error2.code !== 1) {
               const customErr = new Error('Location failed. This often happens because the site is not running on HTTPS/Localhost.');
               customErr.code = 'INSECURE_CONTEXT_FAIL';
               reject(customErr);
            } else {
               reject(error2);
            }
          },
          lowAccuracyOptions
        );
      },
      highAccuracyOptions
    );
  });
}

// Format distance for display
export const formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`
  }
  return `${distance.toFixed(1)}km`
}

