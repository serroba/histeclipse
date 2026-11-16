/** An image from the site's files, once it has loaded (the ocean heat maps, #589; ozone, #722). */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', () => {
      reject(new Error(`could not load ${url}`));
    });
    image.src = url;
  });
}
