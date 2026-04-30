# AnexGate LuCI Theme

Customer-specific LuCI theme based on `luci-theme-material`.

## Build Selection

Package name:

```text
luci-theme-anexgate
```

OpenWrt menuconfig location:

```text
LuCI -> Themes -> luci-theme-anexgate
```

Theme display name:

```text
AnexGate Theme
```

UCI theme entry:

```text
luci.themes.AnexGate=/luci-static/anexgate
```

## Branding Files

Header logo:

```text
htdocs/luci-static/anexgate/brand.png
```

Original downloaded logo:

```text
htdocs/luci-static/anexgate/anexgate-main-logo.png
```

Browser favicon:

```text
htdocs/luci-static/anexgate/favicon.svg
```

## Color Customization

The phase-one AnexGate palette uses a deep ocean blue base. Main colors are controlled in:

```text
htdocs/luci-static/anexgate/custom.css
```

Important variables:

```text
--main-color
--secondary-color
--header-bg
--bar-bg
--submenu-bg-hover-active
--notice-color
```

## Template References

Theme templates:

```text
ucode/template/themes/anexgate/header.ut
ucode/template/themes/anexgate/footer.ut
```

Static URL path:

```text
/luci-static/anexgate
```
