import React, { forwardRef } from "react";

interface NumericInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, placeholder = "0", className = "", ...props }, ref) => {
    const isControlled = value !== undefined;
    const displayValue = isControlled && (value === 0 || value === null) ? "" : value;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
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
        className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";
