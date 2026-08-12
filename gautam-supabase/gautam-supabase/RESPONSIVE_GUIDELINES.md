# RESPONSIVE DESIGN GUIDELINES - TheJournalFX

## BREAKPOINTS (Tailwind)
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md, lg)
- Desktop: ≥ 1024px (xl, 2xl)

## KEY PATTERNS

### 1. CONTAINER & PADDING
```jsx
// Desktop: max-width with centered padding
className="max-w-7xl mx-auto px-8"

// Mobile-first responsive:
className="px-4 sm:px-6 lg:px-8"
```

### 2. GRID LAYOUTS
```jsx
// Mobile: 1 column → Tablet: 2 columns → Desktop: 3-4 columns
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
```

### 3. FONT SIZES
```jsx
className="text-[14px] sm:text-[16px] lg:text-[18px]"
// OR
className="text-sm sm:text-base lg:text-lg"
```

### 4. SPACING
```jsx
className="py-4 sm:py-6 lg:py-8"
className="gap-2 sm:gap-3 lg:gap-4"
```

### 5. TABLES ON MOBILE
```jsx
// On mobile: Horizontal scroll
className="overflow-x-auto"
// On larger: Normal table
```

### 6. CARDS LAYOUT
```jsx
// Always responsive grid
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
```

### 7. BUTTONS
```jsx
className="px-3 sm:px-4 py-2 text-[12px] sm:text-[14px]"
// Or use h-10 for consistent height
className="h-10 px-4 text-sm"
```

### 8. SIDEBAR/PANELS
```jsx
// Mobile: Hidden (use overlay with hamburger)
// Tablet/Desktop: Visible
className="hidden md:block"
```

## SPECIFIC PATTERNS FOR TJFX

### Dashboard Widgets
```jsx
// Responsive widget grid
className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6"
```

### Chart Containers
```jsx
// Fixed aspect ratio, responsive width
className="w-full h-64 sm:h-80 lg:h-96"
```

### Trade Tables
```jsx
// Horizontal scroll on mobile
<div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
  <table className="w-full text-[11px] sm:text-[12px]">
```

### Metrics Display
```jsx
// Mobile: 2 per row → Tablet: 3 → Desktop: 4-6
className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
```

## MOBILE-FIRST APPROACH
1. Write for mobile first: `className="text-sm px-4"`
2. Add breakpoints: `sm:text-base sm:px-6`
3. Enhance on desktop: `lg:text-lg lg:px-8`

## HIDE/SHOW ELEMENTS
```jsx
// Hidden on mobile, show on tablet+
className="hidden sm:block"

// Show on mobile, hidden on tablet+
className="sm:hidden"

// Show mobile/tablet, hidden on desktop
className="lg:hidden"
```

## COMMON ISSUES TO FIX
1. ❌ Fixed widths (w-[260px]) → Use responsive classes
2. ❌ Overflow text → Use truncate or break-words
3. ❌ Fixed heights on containers → Let content determine height
4. ❌ Large fonts → Use responsive text sizes
5. ❌ No horizontal scrolling → Use overflow-x-auto for tables
