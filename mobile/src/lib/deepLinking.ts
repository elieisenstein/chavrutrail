// src/utils/deepLinking.ts

/**
 * Generate a web link for sharing (opens landing page if app not installed)
 */
export function generateRideShareLink(rideId: string): string {
  return `https://chavrutrail.vercel.app/ride/${rideId}`;
}

/**
 * Generate an app deep link (opens directly in app)
 */
export function generateRideAppLink(rideId: string): string {
  return `chavrutrail://ride/${rideId}`;
}

/**
 * Format a share message for WhatsApp/general sharing
 */
export function formatShareMessage(
  rideTitle: string,
  rideId: string,
  isHebrew: boolean
): string {
  const link = generateRideShareLink(rideId);
  
  if (isHebrew) {
    return `בוא נרכב ביחד! 🚴‍♂️\n${rideTitle}\n${link}`;
  } else {
    return `Join me for a ride! 🚴‍♂️\n${rideTitle}\n${link}`;
  }
}