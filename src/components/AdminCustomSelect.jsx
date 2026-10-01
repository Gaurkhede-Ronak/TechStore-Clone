import { Children, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../css/AdminCustomSelect.css";

function flattenText(node) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(flattenText).join("");
  }
  if (node?.props?.children !== undefined) {
    return flattenText(node.props.children);
  }
  return "";
}

function extractOptions(children) {
  const list = [];

  const walk = (nodes) => {
    Children.forEach(nodes, (child) => {
      if (!child) return;
      if (Array.isArray(child)) {
        walk(child);
        return;
      }
      if (child.type === "option" || child?.props?.value !== undefined) {
        const textLabel = flattenText(child.props?.children)
          .replace(/\s+/g, " ")
          .trim();
        const val =
          child.props?.value !== undefined
            ? String(child.props.value)
            : textLabel;

        list.push({
          value: val,
          label: textLabel || val,
          disabled: Boolean(child.props?.disabled),
        });
      } else if (child.props?.children) {
        walk(child.props.children);
      }
    });
  };

  walk(children);
  return list;
}

function AdminCustomSelect({
  value,
  onChange,
  name,
  disabled = false,
  required = false,
  children,
  placeholder = "Select Option",
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const [isDark, setIsDark] = useState(false);

  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const options = useMemo(() => extractOptions(children), [children]);

  const stringValue = value !== undefined && value !== null ? String(value) : "";

  const selectedOption = useMemo(() => {
    const exact = options.find((opt) => opt.value === stringValue);
    if (exact) return exact;
    return options[0] || { value: "", label: placeholder };
  }, [options, stringValue, placeholder]);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 220 && rect.top > 240;

    const darkActive =
      document.body.classList.contains("dark") ||
      document.body.classList.contains("dark-mode") ||
      Boolean(buttonRef.current.closest(".dark, .dark-mode"));

    setIsDark(darkActive);

    if (openUpward) {
      setMenuStyle({
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        bottom: `${window.innerHeight - rect.top + 7}px`,
        top: "auto",
      });
    } else {
      setMenuStyle({
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        top: `${rect.bottom + 7}px`,
        bottom: "auto",
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    const handleOutsideClick = (event) => {
      if (
        wrapperRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updateMenuPosition();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [open, updateMenuPosition]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      updateMenuPosition();
    }
    setOpen((prev) => !prev);
  };

  const handleSelectOption = (optionValue) => {
    if (disabled) return;
    if (onChange) {
      onChange({
        target: {
          name: name || "",
          value: optionValue,
        },
        currentTarget: {
          name: name || "",
          value: optionValue,
        },
      });
    }
    setOpen(false);
  };

  return (
    <div className="admin-custom-select" ref={wrapperRef}>
      {required && (
        <input
          type="text"
          className="admin-custom-hidden-input"
          name={name}
          value={stringValue}
          required={required}
          readOnly
          tabIndex={-1}
        />
      )}

      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`admin-custom-select-button ${open ? "active" : ""}`}
        onClick={handleToggle}
      >
        <span className="admin-custom-select-label">
          {selectedOption?.label ?? placeholder}
        </span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          fill="currentColor"
          viewBox="0 0 16 16"
          className={`admin-custom-arrow ${open ? "rotate" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
          />
        </svg>
      </button>

      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menuRef}
            className={`admin-custom-menu ${isDark ? "dark-menu" : ""}`}
            style={menuStyle}
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === selectedOption?.value;
              return (
                <button
                  type="button"
                  key={`${opt.value}-${idx}`}
                  disabled={opt.disabled}
                  className={`admin-custom-option ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelectOption(opt.value)}
                >
                  <span>{opt.label}</span>

                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                      className="admin-option-check"
                    >
                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

export default AdminCustomSelect;
