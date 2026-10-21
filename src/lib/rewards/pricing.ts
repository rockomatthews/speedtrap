// UI estimate only. PostgreSQL authoritatively reserves and prices every wallet hold.
export function walletEstimate(subtotalCents:number,purchasedBalance:number,promoBalance:number,usePurchased:boolean,useRewards:boolean,discountPercent:number){
 const promo=useRewards&&discountPercent===0?Math.min(Math.max(0,promoBalance),Math.floor(subtotalCents*.25)):0;
 const subtotal=subtotalCents-promo,tax=Math.round(subtotal*.08),total=subtotal+tax;
 let purchased=usePurchased?Math.min(Math.max(0,purchasedBalance),total):0;
 if(total-purchased>0&&total-purchased<50)purchased=Math.max(0,total-50);
 return {subtotal_cents:subtotal,sales_tax_cents:tax,amount_cents:total-purchased,wallet_purchased_cents:purchased,wallet_promo_cents:promo};
}
