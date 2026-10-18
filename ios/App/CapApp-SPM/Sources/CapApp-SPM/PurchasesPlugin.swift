import Capacitor
import StoreKit

// NOTE on the accessor/reject style below: this project's exact resolved
// Capacitor binary (capacitor-swift-pm 8.5.0, a precompiled XCFramework —
// confirmed via its .swiftinterface, not the npm-vendored source, which is
// a different build) gates every optional-returning JS-value accessor
// (getString(key) -> String?, getArray(key) -> JSArray?, etc.) AND
// CAPPluginCall.reject(...) itself behind "#if compiler(>=5.3) &&
// $NonescapableTypes", an experimental feature flag this toolchain doesn't
// have enabled — so those symbols are genuinely unavailable here, not a
// cascading error. Worked around by (a) only ever using each accessor's
// ungated 2-arg "with a default value" overload, and (b) bouncing `reject`
// through a tiny local @objc protocol, so the call is resolved dynamically
// via the Objective-C runtime (where the underlying method definitely
// exists — confirmed in the framework's generated Capacitor-Swift.h) rather
// than through the broken static Swift interface declaration.
@objc private protocol RejectableCall {
    func reject(_ message: String, _ code: String?, _ error: Error?, _ data: [String: Any]?)
}

private func rejectCall(_ call: CAPPluginCall, _ message: String, _ error: Error? = nil) {
    (call as AnyObject as? RejectableCall)?.reject(message, nil, error, nil)
}

@objc(PurchasesPlugin)
public class PurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PurchasesPlugin"
    public let jsName = "Purchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise),
    ]

    @objc public func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", []).compactMap { $0 as? String }
        guard !ids.isEmpty else {
            rejectCall(call, "missing productIds")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map {
                    ["id": $0.id, "displayName": $0.displayName, "description": $0.description, "displayPrice": $0.displayPrice]
                }])
            } catch {
                rejectCall(call, "Failed to fetch products", error)
            }
        }
    }

    @objc public func purchase(_ call: CAPPluginCall) {
        let id = call.getString("productId", "")
        guard !id.isEmpty else {
            rejectCall(call, "missing productId")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    rejectCall(call, "Product not found")
                    return
                }
                switch try await product.purchase() {
                case .success(.verified(let transaction)):
                    await transaction.finish()
                    call.resolve(["success": true, "productId": transaction.productID])
                case .success(.unverified):
                    rejectCall(call, "Transaction could not be verified")
                case .userCancelled:
                    call.resolve(["success": false, "cancelled": true])
                case .pending:
                    call.resolve(["success": false, "pending": true])
                @unknown default:
                    rejectCall(call, "Unknown purchase result")
                }
            } catch {
                rejectCall(call, "Purchase failed", error)
            }
        }
    }

    @objc public func restorePurchases(_ call: CAPPluginCall) {
        Task {
            try? await AppStore.sync()
            call.resolve()
        }
    }

    @objc public func getEntitlements(_ call: CAPPluginCall) {
        Task {
            var owned: [String] = []
            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result {
                    owned.append(transaction.productID)
                }
            }
            call.resolve(["productIds": owned])
        }
    }
}
