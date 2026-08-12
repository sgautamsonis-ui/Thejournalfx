# DETAILED PAGE-BY-PAGE MIGRATION STEPS

## Dashboard.jsx - RESPONSIVE UPDATE

### Change 1: Main Container (Top Section)
**Find & Replace:**
```jsx
// BEFORE (Line ~1000)
<div className="px-8 py-8 bg-[#F6F6FB] min-h-screen">
  <div className="max-w-7xl mx-auto">
    <div className="flex items-center justify-between mb-6">

// AFTER
<div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-[#F6F6FB] min-h-screen">
  <div className="max-w-7xl mx-auto">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
```

### Change 2: Header Title
**Find & Replace:**
```jsx
// BEFORE
<h1 className="font-display text-3xl font-bold text-[#16151F]">Dashboard</h1>

// AFTER
<h1 className="font-display text-2xl sm:text-3xl font-bold text-[#16151F]">Dashboard</h1>
```

### Change 3: Widget Grid Container
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-12 gap-6 mt-6">

// AFTER
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
```

### Change 4: KPI Cards Row (StatCard components)
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-6 gap-4">
  <StatCard label="Net P&L" value={...} />
  {/* more cards */}
</div>

// AFTER
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
  <StatCard label="Net P&L" value={...} />
  {/* more cards */}
</div>
```

### Change 5: Text Sizes in Component Props
**Find & Replace:**
```jsx
// BEFORE
<div className="text-[16px]">Text</div>

// AFTER
<div className="text-[13px] sm:text-[14px] lg:text-[16px]">Text</div>
```

### Change 6: Customize Button
**Find & Replace:**
```jsx
// BEFORE
<button className="px-4 py-2 text-[14px]">
  <Settings2 className="w-4 h-4" /> Customize
</button>

// AFTER
<button className="px-3 sm:px-4 py-2 text-[12px] sm:text-[14px] min-h-[40px]">
  <Settings2 className="w-4 h-4" /> Customize
</button>
```

---

## TradeView.jsx - RESPONSIVE UPDATE

### Change 1: Main Container
**Find & Replace:**
```jsx
// BEFORE
<div className="px-8 py-8 bg-[#F6F6FB] min-h-screen">

// AFTER
<div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-[#F6F6FB] min-h-screen">
```

### Change 2: Header Section
**Find & Replace:**
```jsx
// BEFORE
<div className="flex items-center justify-between mb-6">
  <h1 className="text-3xl font-bold">Trade View</h1>
  <div className="flex gap-2">

// AFTER
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
  <h1 className="text-2xl sm:text-3xl font-bold">Trade View</h1>
  <div className="flex gap-2 flex-wrap">
```

### Change 3: Search Box
**Find & Replace:**
```jsx
// BEFORE
<input className="px-4 py-2 text-[14px] w-[300px]" />

// AFTER
<input className="px-3 sm:px-4 py-2 text-[12px] sm:text-[14px] w-full sm:w-[300px]" />
```

### Change 4: Filter Panel (Make Collapsible on Mobile)
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
  {/* filters */}
</div>

// AFTER
<button onClick={() => setShowFilters(!showFilters)} className="md:hidden mb-3 text-[#7C3AED]">
  {showFilters ? "Hide" : "Show"} Filters
</button>
<div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 ${showFilters ? "" : "hidden md:grid"}`}>
  {/* filters */}
</div>
```

### Change 5: Trade Table (Responsive Wrapper)
**Find & Replace:**
```jsx
// BEFORE
<table className="w-full text-[12px]">
  <thead>...

// AFTER
<div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
  <table className="w-full text-[10px] sm:text-[11px] lg:text-[12px]">
    <thead>...
</div>
```

### Change 6: Tabs
**Find & Replace:**
```jsx
// BEFORE
<div className="flex gap-2 mb-4">
  {tabs.map(t => <button className="px-4 py-2">{t}</button>)}
</div>

// AFTER
<div className="flex gap-1 sm:gap-2 mb-4 overflow-x-auto">
  {tabs.map(t => <button className="px-2 sm:px-4 py-2 text-[11px] sm:text-[12px] whitespace-nowrap">{t}</button>)}
</div>
```

---

## AddTrade.jsx - RESPONSIVE UPDATE

### Change 1: Container
**Find & Replace:**
```jsx
// BEFORE
<div className="px-8 py-8 bg-[#F6F6FB] min-h-screen">
  <div className="max-w-4xl mx-auto">
    <div className="flex gap-8">
      {/* Form on left */}
      {/* Preview on right */}
    </div>

// AFTER
<div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-[#F6F6FB] min-h-screen">
  <div className="max-w-6xl mx-auto">
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
      {/* Form on left - full width mobile */}
      <div className="flex-1">
      {/* Preview on right - full width mobile */}
      <div className="w-full lg:w-96">
```

### Change 2: Form Inputs
**Find & Replace:**
```jsx
// BEFORE
<input className="w-full px-4 py-2 text-[14px]" />

// AFTER
<input className="w-full px-3 sm:px-4 py-2 text-[13px] sm:text-[14px] min-h-[40px]" />
```

### Change 3: Button Groups (Stack on Mobile)
**Find & Replace:**
```jsx
// BEFORE
<div className="flex gap-3">
  <button>Button 1</button>
  <button>Button 2</button>
</div>

// AFTER
<div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
  <button className="flex-1">Button 1</button>
  <button className="flex-1">Button 2</button>
</div>
```

### Change 4: Grid Layout (Form Rows)
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-2 gap-4">
  <div>Symbol</div>
  <div>Direction</div>
</div>

// AFTER
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
  <div>Symbol</div>
  <div>Direction</div>
</div>
```

---

## BiasCenter.jsx - RESPONSIVE UPDATE

### Change 1: Main Container
**Find & Replace:**
```jsx
// BEFORE
<div className="px-8 py-8 bg-[#F6F6FB] min-h-screen">

// AFTER
<div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-[#F6F6FB] min-h-screen">
```

### Change 2: Bias Cards Grid
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-3 gap-6 mt-6">
  {/* Bias cards */}
</div>

// AFTER
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
  {/* Bias cards */}
</div>
```

### Change 3: Bias Card Interior
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-2 gap-3">
  {/* Form fields */}
</div>

// AFTER
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
  {/* Form fields */}
</div>
```

---

## Tracker.jsx - RESPONSIVE UPDATE

### Change 1: Container
**Find & Replace:**
```jsx
// BEFORE
<div className="px-8 py-8 bg-[#F6F6FB] min-h-screen">
  <div className="flex gap-8">
    {/* Calendar on left */}
    {/* Stats on right */}

// AFTER
<div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-[#F6F6FB] min-h-screen">
  <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
    {/* Calendar - full width on mobile */}
    <div className="w-full lg:w-96">
    {/* Stats - full width on mobile */}
    <div className="flex-1">
```

### Change 2: Calendar
**Find & Replace:**
```jsx
// BEFORE
<div className="w-[400px]">Calendar</div>

// AFTER
<div className="w-full lg:w-[400px]">Calendar</div>
```

### Change 3: Stats Cards Grid
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-3 gap-4">

// AFTER
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 sm:gap-4">
```

---

## Settings.jsx - RESPONSIVE UPDATE

### Change 1: Container
**Find & Replace:**
```jsx
// BEFORE
<div className="px-8 py-8 bg-[#F6F6FB] min-h-screen">
  <div className="flex gap-8">
    {/* Nav on left */}
    {/* Content on right */}

// AFTER
<div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-[#F6F6FB] min-h-screen">
  <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
    {/* Nav */}
    <nav className="w-full lg:w-48 shrink-0">
    {/* Content */}
    <div className="flex-1">
```

### Change 2: Nav Items
**Find & Replace:**
```jsx
// BEFORE
<button className="px-4 py-2 text-[14px]">Setting 1</button>

// AFTER
<button className="px-3 sm:px-4 py-2 text-[12px] sm:text-[14px] w-full text-left">Setting 1</button>
```

### Change 3: Form Fields
**Find & Replace:**
```jsx
// BEFORE
<input className="px-4 py-2 w-[300px]" />

// AFTER
<input className="px-3 sm:px-4 py-2 w-full" />
```

### Change 4: Settings Grid
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-2 gap-6">

// AFTER
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
```

---

## Notebook.jsx - RESPONSIVE UPDATE

### Change 1: Container
**Find & Replace:**
```jsx
// BEFORE
<div className="px-8 py-8 bg-[#F6F6FB] min-h-screen">

// AFTER
<div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-[#F6F6FB] min-h-screen">
```

### Change 2: Notes Grid
**Find & Replace:**
```jsx
// BEFORE
<div className="grid grid-cols-3 gap-6">

// AFTER
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
```

### Change 3: Note Card
**Find & Replace:**
```jsx
// BEFORE
<div className="p-4 text-[14px]">

// AFTER
<div className="p-3 sm:p-4 text-[12px] sm:text-[14px]">
```

---

## Records.jsx - RESPONSIVE UPDATE

### Change 1: Container
**Find & Replace:**
```jsx
// BEFORE
<div className="px-8 py-8 bg-[#F6F6FB] min-h-screen">

// AFTER
<div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-[#F6F6FB] min-h-screen">
```

### Change 2: Records Table (Horizontal Scroll)
**Find & Replace:**
```jsx
// BEFORE
<table className="w-full text-[12px]">

// AFTER
<div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
  <table className="w-full text-[10px] sm:text-[11px] lg:text-[12px]">
</div>
```

### Change 3: Header Buttons
**Find & Replace:**
```jsx
// BEFORE
<button className="px-4 py-2">Export</button>

// AFTER
<button className="px-3 sm:px-4 py-2 text-[12px] sm:text-[14px]">Export</button>
```

---

## Login.jsx - RESPONSIVE UPDATE

### Change 1: Container
**Find & Replace:**
```jsx
// BEFORE
<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#7C3AED] to-[#6D28D9]">
  <div className="w-[400px] bg-white p-8 rounded-2xl">

// AFTER
<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] px-4">
  <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl">
```

### Change 2: Title
**Find & Replace:**
```jsx
// BEFORE
<h1 className="text-[28px] font-bold">Login</h1>

// AFTER
<h1 className="text-[22px] sm:text-[28px] font-bold">Login</h1>
```

### Change 3: Inputs
**Find & Replace:**
```jsx
// BEFORE
<input className="w-full px-4 py-2 text-[14px]" />

// AFTER
<input className="w-full px-3 sm:px-4 py-2 text-[13px] sm:text-[14px] min-h-[44px]" />
```

---

## APPLY THESE CHANGES

1. Open each file mentioned above
2. Find the BEFORE code (use Ctrl+F)
3. Replace with AFTER code
4. Save the file
5. Test in browser (F12 → Toggle device toolbar)
6. Move to next file

**That's it! All pages will be responsive!** ✅

---

## QUICK TESTING AFTER CHANGES

```bash
# Start development server
npm run dev

# Open in browser, press F12
# Click mobile device icon (top left)
# Test at 375px, 768px, 1920px widths
```

**Done! 🎉**
