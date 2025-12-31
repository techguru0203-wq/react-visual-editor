export function generateDeployDocId(
  docName: string,
  docType: string,
  documentId: string
): string {
  const isAsciiOnly = /^[\x00-\x7F]*$/.test(docName); // Check if the document name contains only ASCII characters
  const namePart = isAsciiOnly
    ? docName.split(' - ').pop()?.replace(/\s/g, '') || ''
    : ''; // If not ASCII, we don't include the name part in the ID
  return `${namePart ? namePart + '-' : ''}${docType.substring(
    0,
    4
  )}-${documentId.substring(0, 12)}`.toLowerCase();
}
