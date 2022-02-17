import React from 'react'

type Props = {
  className: string
  numerator: number
  denominator: number
}

export const VoteAnswerBar: React.FC<Props> = ({
  className,
  numerator,
  denominator
}) => {
  return (
    <li
      className={className}
      style={{ width: `${(numerator / denominator) * 100 || 0}%` }}
    ></li>
  )
}
