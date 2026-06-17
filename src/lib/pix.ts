// Algoritmo de cálculo do CRC16-CCITT (Polinômio 0x1021)
function calculateCRC16(data: string): string {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < data.length; i++) {
    const b = data.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      const bit = ((b >> (7 - j)) & 1) === 1;
      const c15 = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) {
        crc ^= polynomial;
      }
    }
  }

  crc &= 0xFFFF;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera a string do Pix Copia e Cola (padrão EMV BR Code estático)
 */
export function generateStaticPix({
  key,
  name,
  city,
  amount,
  txid = '***'
}: {
  key: string;
  name: string;
  city: string;
  amount?: number;
  txid?: string;
}): string {
  const formatField = (id: string, value: string): string => {
    const size = value.length.toString().padStart(2, '0');
    return `${id}${size}${value}`;
  };

  // Limpa caracteres especiais e acentos
  const cleanString = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-zA-Z0-9 ]/g, '')  // Mantém apenas letras, números e espaços
      .trim()
      .substring(0, 25);
  };

  const cleanName = cleanString(name || 'Empresa');
  const cleanCity = cleanString(city || 'Sao Paulo').substring(0, 15);

  // Informações da conta Pix do recebedor (ID 26)
  // Sub-ID 00: br.gov.bcb.pix (obrigatório)
  // Sub-ID 01: Chave Pix (e-mail, celular, CNPJ, CPF, aleatória)
  const merchantAccountInfo = 
    formatField('00', 'br.gov.bcb.pix') + 
    formatField('01', key.replace(/\s/g, ''));

  let payload = 
    formatField('00', '01') + // Payload Indicator
    formatField('01', '12') + // Point of Initiation Method (12 = reusável/estático com valor fixo)
    formatField('26', merchantAccountInfo) +
    formatField('52', '0000') + // Merchant Category Code
    formatField('53', '986') + // Currency Code (986 = BRL Real)
    (amount && amount > 0 ? formatField('54', amount.toFixed(2)) : '') + // Amount (opcional no estático)
    formatField('58', 'BR') + // Country Code
    formatField('59', cleanName) + // Merchant Name
    formatField('60', cleanCity) + // Merchant City
    formatField('62', formatField('05', txid)); // Additional Data (TxID)

  payload += '6304'; // CRC16 indicator (ID 63 + tamanho 04)

  const crc = calculateCRC16(payload);
  return payload + crc;
}
