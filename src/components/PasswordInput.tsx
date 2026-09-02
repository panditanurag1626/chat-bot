"use client";

import { useState } from "react";

export default function PasswordInput(props: {
  name: string;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-wrap">
      <input
        name={props.name}
        type={show ? "text" : "password"}
        required={props.required}
        minLength={props.minLength}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
      />
      <button
        type="button"
        className="pw-toggle"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
      >
        <i className={show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"} />
      </button>
    </span>
  );
}
