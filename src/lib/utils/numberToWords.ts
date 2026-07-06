/**
 * Converts a numeric amount into Indian currency words representation (e.g. Rupees and Paise).
 */
export function numberToWords(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const formatTens = (n: number) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
  };

  const formatHundreds = (n: number) => {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (str !== "") str += "and ";
      str += formatTens(n);
    }
    return str;
  };

  let rupee = Math.floor(num);
  let paise = Math.round((num - rupee) * 100);
  
  let result = "";

  if (rupee > 0) {
    let crore = Math.floor(rupee / 10000000);
    rupee %= 10000000;
    let lakh = Math.floor(rupee / 100000);
    rupee %= 100000;
    let thousand = Math.floor(rupee / 1000);
    rupee %= 1000;

    if (crore > 0) result += formatHundreds(crore) + " Crore ";
    if (lakh > 0) result += formatHundreds(lakh) + " Lakh ";
    if (thousand > 0) result += formatHundreds(thousand) + " Thousand ";
    if (rupee > 0) result += formatHundreds(rupee);
    
    result += " Rupees";
  }

  if (paise > 0) {
    if (result !== "") result += " and ";
    result += formatTens(paise) + " Paise";
  }

  return result ? result + " Only" : "Zero Rupees Only";
}
