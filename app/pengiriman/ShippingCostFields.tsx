import { shippingCostFields, type ShippingCosts } from "./shipping-costs";

export function ShippingCostFields({ values }: { values?: ShippingCosts }) {
  return (
    <>
      {shippingCostFields.map(({ key, label }) => (
        <label key={key}>
          <span>{label}</span>
          <input
            defaultValue={values?.[key] || ""}
            min="0"
            name={key}
            placeholder="0"
            step="1"
            type="number"
          />
        </label>
      ))}
    </>
  );
}
