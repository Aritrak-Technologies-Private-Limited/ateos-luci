module("luci.controller.quectel_cm", package.seeall)

function index()
    entry({"admin", "services", "quectel_cm"}, alias("admin", "services", "quectel_cm", "config"), _("Quectel CM"), 70)
    entry({"admin", "services", "quectel_cm", "config"}, template("quectel_cm/config"), _("Configuration"), 1)
end
