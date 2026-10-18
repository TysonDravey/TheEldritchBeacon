import Capacitor
import PostHog

// Native PostHog, not posthog-js in the WKWebView -- the web build already
// has a documented, empirically-confirmed ~5.2s cold-launch delay from
// posthog-js's init() attempting a network request from inside the webview
// (see instrumentation-client.ts's comment); a native SDK call happens on a
// background thread outside that critical path entirely, so it can't repeat
// that problem. Same accessor-gating workaround as PurchasesPlugin.swift
// (see that file's header comment for why): only the 2-arg default-value
// CAPPluginCall accessors are used here, and `properties` is passed over
// the bridge as a JSON string rather than a dictionary, sidestepping any
// uncertainty about whether this XCFramework's getObject(...) accessor is
// similarly gated (never directly confirmed, unlike getString/getArray).
@objc(AnalyticsPlugin)
public class AnalyticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AnalyticsPlugin"
    public let jsName = "Analytics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "capture", returnType: CAPPluginReturnPromise),
    ]

    private static var didSetup = false

    @objc public func setup(_ call: CAPPluginCall) {
        guard !AnalyticsPlugin.didSetup else { call.resolve(); return }
        let token = call.getString("token", "")
        // No token configured (e.g. a local dev build with no .env.local) --
        // silently no-op, matching the web bundle's own `if (POSTHOG_TOKEN)`
        // guard rather than ever calling setup() with an invalid token.
        guard !token.isEmpty else { call.resolve(); return }
        let host = call.getString("host", "https://us.i.posthog.com")
        let config = PostHogConfig(projectToken: token, host: host)
        // Deliberately minimal -- same philosophy as the web config (see
        // instrumentation-client.ts): custom events only, no session replay,
        // no autocaptured screen views/taps. Keeps the data collected (and
        // the App Privacy disclosure it requires) to exactly what's used.
        config.sessionReplay = false
        config.captureScreenViews = false
        config.captureElementInteractions = false
        PostHogSDK.shared.setup(config)
        AnalyticsPlugin.didSetup = true
        call.resolve()
    }

    @objc public func capture(_ call: CAPPluginCall) {
        let event = call.getString("event", "")
        guard !event.isEmpty else { call.resolve(); return }
        let propertiesJson = call.getString("propertiesJson", "{}")
        var properties: [String: Any] = [:]
        if let data = propertiesJson.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            properties = parsed
        }
        PostHogSDK.shared.capture(event, properties: properties)
        call.resolve()
    }
}
