import React from "react";

type Props = {
  value: string;
  placeholder?: string;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function SearchBar({
  value,
  placeholder,
  onChange,
  onKeyDown,
  inputRef,
}: Props) {
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder ?? 'Type keyword (e.g. "leetcode")'}
      autoFocus
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.07)",
        color: "white",
        fontSize: 14,
        marginTop: 12,
        outline: "none",
      }}
    />
  );
}
