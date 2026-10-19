/**
 * Favorites Manager
 * Handles storing, reading, and toggling favorite insurance plans per user
 */

export const getFavoritesStorageKey = (userId) => {
  return userId ? `insurance_user_favorites_${userId}` : 'insurance_user_favorites_guest';
};

export const getFavorites = (userId) => {
  try {
    const key = getFavoritesStorageKey(userId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const isPlanFavorite = (userId, offer) => {
  if (!offer) return false;
  const list = getFavorites(userId);
  const targetId = offer._id ? String(offer._id) : null;
  const targetCode = offer.policyReferenceCode ? String(offer.policyReferenceCode).toLowerCase() : null;
  const targetName = offer.planName ? String(offer.planName).toLowerCase() : null;

  return list.some((item) => {
    if (targetId && item._id && String(item._id) === targetId) return true;
    if (targetCode && item.policyReferenceCode && String(item.policyReferenceCode).toLowerCase() === targetCode) return true;
    if (targetName && item.planName && String(item.planName).toLowerCase() === targetName) return true;
    return false;
  });
};

export const togglePlanFavorite = (userId, offer) => {
  if (!offer) return { isFav: false, list: [] };
  const key = getFavoritesStorageKey(userId);
  const list = getFavorites(userId);

  const targetId = offer._id ? String(offer._id) : null;
  const targetCode = offer.policyReferenceCode ? String(offer.policyReferenceCode).toLowerCase() : null;
  const targetName = offer.planName ? String(offer.planName).toLowerCase() : null;

  const existingIdx = list.findIndex((item) => {
    if (targetId && item._id && String(item._id) === targetId) return true;
    if (targetCode && item.policyReferenceCode && String(item.policyReferenceCode).toLowerCase() === targetCode) return true;
    if (targetName && item.planName && String(item.planName).toLowerCase() === targetName) return true;
    return false;
  });

  let isFav = false;
  let updatedList = [];

  if (existingIdx >= 0) {
    // Remove from favorites
    updatedList = list.filter((_, idx) => idx !== existingIdx);
    isFav = false;
  } else {
    // Add to favorites
    const newEntry = {
      _id: offer._id || `fav_${Date.now()}`,
      planName: offer.planName,
      insurer: offer.insurer || 'General Carrier',
      policyCategory: offer.policyCategory || 'GENERAL',
      policyReferenceCode: offer.policyReferenceCode || '',
      annualCoverageAmount: offer.annualCoverageAmount || 'Standard Limit',
      illustrativePremium: offer.illustrativePremium || 'Standard Rate',
      coverageSubtype: offer.coverageSubtype || '',
      excessDeductible: offer.excessDeductible || '',
      benefitSublimits: offer.benefitSublimits || '',
      waitingPeriods: offer.waitingPeriods || '',
      favoritedAt: new Date().toISOString()
    };
    updatedList = [newEntry, ...list];
    isFav = true;
  }

  try {
    localStorage.setItem(key, JSON.stringify(updatedList));
  } catch (_) {}

  // Dispatch global window event so any open component re-syncs state immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('insurance_favorites_changed', {
        detail: { userId, offer, isFav, list: updatedList }
      })
    );
  }

  return { isFav, list: updatedList };
};
