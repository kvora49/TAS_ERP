import React, { forwardRef } from "react";

interface NumericInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, placeholder = "0", ...props }, ref) => {
    // If value is undefined, treat it as an uncontrolled input (so we don't pass value at all)
    const isControlled = value !== undefined;
    // If value is 0 or null, show empty string so the placeholder is displayed
    const displayValue = isControlled && (value === 0 || value === null) ? "" : value;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // If the current value is 0, select it on focus to make typing easy
      if (Number(e.target.value) === 0) {
        e.target.select();
      }
      if (props.onFocus) {
        props.onFocus(e);
      }
    };

    return (
      <input
        ref={ref}
        type="number"
        placeholder={placeholder}
        onChange={onChange}
        onFocus={handleFocus}
        {...(isControlled ? { value: displayValue } : {})}
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";

