export const base64ToFile = (base64Data: string) => {
  const arr = base64Data.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  const byteNumbers = new Array(bstr.length);

  for (let i = 0; i < bstr.length; i++) {
    byteNumbers[i] = bstr.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], 'image', { type: mime });
};

export const convertToBase64 = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
