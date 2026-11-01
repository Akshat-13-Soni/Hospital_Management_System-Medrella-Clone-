export const rupees = (paise: number) =>
    "₹" + (paise /100).toLocaleString("en-IN", { maximumFractionDigits: 2 });