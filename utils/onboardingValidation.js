/**
 * Required onboarding fields before marking profile complete.
 */
const hasAddress = (data) => {
  if (data.address?.trim()) return true;
  const parts = [data.houseNumber, data.streetName, data.suburb, data.state, data.postcode];
  return parts.filter((p) => p?.trim()).length >= 3;
};

const validateOnboardingRequired = (body, existingUser = {}) => {
  const errors = [];
  const merged = {
    dateOfBirth: body.dateOfBirth ?? existingUser.dateOfBirth,
    address: body.address ?? existingUser.address,
    houseNumber: body.houseNumber ?? existingUser.houseNumber,
    streetName: body.streetName ?? existingUser.streetName,
    suburb: body.suburb ?? existingUser.suburb,
    state: body.state ?? existingUser.state,
    postcode: body.postcode ?? existingUser.postcode,
    workRightsInAustralia: body.workRightsInAustralia ?? existingUser.workRightsInAustralia,
    visaType: body.visaType ?? existingUser.visaType,
    visaAttachment_details: body.visaAttachment_details ?? existingUser.visaAttachment_details,
    primaryJobTitles: body.primaryJobTitles ?? existingUser.primaryJobTitles,
    skills: body.skills ?? existingUser.skills,
    minAcceptableSalary: body.minAcceptableSalary ?? existingUser.minAcceptableSalary,
  };

  if (!merged.dateOfBirth || Number.isNaN(new Date(merged.dateOfBirth).getTime())) {
    errors.push('Date of birth is required');
  }

  if (!hasAddress(merged)) {
    errors.push('Residential address is required');
  }

  if (!merged.workRightsInAustralia) {
    errors.push('Work rights in Australia is required');
  }

  if (merged.workRightsInAustralia === 'Visa Holder') {
    if (!merged.visaType?.trim()) {
      errors.push('Visa type is required for visa holders');
    }
    if (!merged.visaAttachment_details) {
      errors.push('Visa attachment is required for visa holders');
    }
  }

  const jobTitles = Array.isArray(merged.primaryJobTitles)
    ? merged.primaryJobTitles
  : [];
  if (!jobTitles.length) {
    errors.push('At least one primary job title is required');
  }

  const skills = Array.isArray(merged.skills) ? merged.skills : [];
  if (!skills.length) {
    errors.push('At least one skill is required');
  }

  const minSalary = merged.minAcceptableSalary;
  if (minSalary === undefined || minSalary === null || minSalary === '' || Number(minSalary) <= 0) {
    errors.push('Minimum acceptable salary is required');
  }

  return errors;
};

module.exports = { validateOnboardingRequired, hasAddress };
