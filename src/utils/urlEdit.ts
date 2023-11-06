export const updateURLParameter = (url: string, param: string, paramVal: string) => {
  let anchor = null;
  let newAdditionalURL = '';
  let tempArray = url.split('?');
  let baseURL = tempArray[0];
  let additionalURL = tempArray[1];
  let temp = '';

  if (additionalURL) {
    const tmpAnchor = additionalURL.split('#');
    const params = tmpAnchor[0];
    anchor = tmpAnchor[1];
    if (anchor) additionalURL = params;

    tempArray = additionalURL.split('&');

    for (let i = 0; i < tempArray.length; i++) {
      if (tempArray[i].split('=')[0] !== param) {
        newAdditionalURL += temp + tempArray[i];
        temp = '&';
      }
    }
  } else {
    const tmpAnchor = baseURL.split('#');
    const TheParams = tmpAnchor[0];
    anchor = tmpAnchor[1];

    if (TheParams) baseURL = TheParams;
  }

  if (anchor) paramVal += '#' + anchor;

  const rows_txt = temp + '' + param + '=' + paramVal;
  return baseURL + '?' + newAdditionalURL + rows_txt;
};
