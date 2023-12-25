import React, { useMemo } from 'react'
import styled from '@emotion/styled'

type Props = {
  onChange: (checked: boolean) => void
  checked: boolean
}

export function ToggleSwitch(props: Props) {
  const id = useMemo(() => {
    const randomValues = crypto.randomUUID()
    return `toggle-${randomValues}`
  }, [])

  return (
    <Wrap>
      <input
        type="checkbox"
        id={id}
        onChange={() => props.onChange(!props.checked)}
        checked={props.checked}
      />
      <label htmlFor={id}>
        <span className="slider" />
      </label>
    </Wrap>
  )
}

const Wrap = styled.div`
  --toggle-switch-width-size: 40px;

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--toggle-switch-width-size);
  height: var(--toggle-switch-width-size);

  label {
    position: absolute;
    width: 100%;
    height: calc(var(--toggle-switch-width-size) / 2);
    border: 1px solid var(--color-border);
    background-color: var(--color-secondary);
    border-radius: 50px;
    cursor: pointer;
  }

  input {
    display: none;
  }

  .slider {
    width: 100%;
    height: 100%;
    border-radius: 50px;
    transition: 0.3s;
    ::before {
      --slider-margin: 2px;
      --slider-size: calc(
        (var(--toggle-switch-width-size) - 2px) / 2 - var(--slider-margin) * 2
      );
      content: '';
      position: absolute;
      top: var(--slider-margin);
      left: var(--slider-margin);
      width: var(--slider-size);
      height: var(--slider-size);
      background-color: var(--color-on-background);
      border-radius: 50%;
      transition: 0.3s;
    }
  }

  input:checked + label {
    background-color: var(--color-checked);
  }

  input:checked + label .slider::before {
    left: calc(100% - var(--slider-size) - var(--slider-margin));
  }
`
