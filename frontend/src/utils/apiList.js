export function readApiList(response, key) {
  if (key) {
    const direct = response?.[key];
    if (Array.isArray(direct)) return direct;

    const wrapped = response?.data?.[key];
    if (Array.isArray(wrapped)) return wrapped;
    return [];
  }

  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

export function readAutomaticCosting(response) {
  return Boolean(response?.automaticCosting ?? response?.data?.automaticCosting);
}
