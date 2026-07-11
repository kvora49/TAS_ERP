import React, { forwardRef } from "react";

interface NumericInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, placeholder = "0", ...props }, ref) => {
    // If value is 0, null, or undefined, show empty string so the placeholder is displayed
    const displayValue = value === 0 || value === null || value === undefined ? "" : value;

    return (
      <input
        ref={ref}
        type="number"
        value={displayValue}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={(e) => {
          // If the current value is 0, clear it on focus to make typing easy
          if (Number(e.target.value) === 0) {
            e.target.select();
          }
        }}
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";
