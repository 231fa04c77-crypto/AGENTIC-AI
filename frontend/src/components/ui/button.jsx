import * as React from "react"

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
  
  const variants = {
    default: "bg-primary text-white shadow hover:bg-primary/90",
    destructive: "bg-red-500 text-white shadow-sm hover:bg-red-500/90",
    outline: "border border-gray-200 bg-white shadow-sm hover:bg-gray-100 hover:text-gray-900",
    secondary: "bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-100/80",
    ghost: "hover:bg-gray-100 hover:text-gray-900",
    link: "text-primary underline-offset-4 hover:underline",
  }

  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-8",
    icon: "h-10 w-10 rounded-full",
  }

  const variantStyle = variants[variant] || variants.default
  const sizeStyle = sizes[size] || sizes.default

  return (
    <button
      className={`${baseStyles} ${variantStyle} ${sizeStyle} ${className || ""}`}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
