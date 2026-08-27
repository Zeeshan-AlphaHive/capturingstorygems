"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PrivateRoute } from "@/utils/RouteProtection";
import { getMyCart } from "@/utils/cartClient";
import { Button } from "@/components/ui/Button";
import { loadStripe } from "@stripe/stripe-js";
const serverBaseUrl = process.env.NEXT_PUBLIC_BACKEND_SERVER_URL;
const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string;
console.log("Stripe PK in CartPage:", stripePublicKey);

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatMoney = (value: number | string, currency: string | undefined) => {
    const num = typeof value === "number" ? value : Number(value || 0);
    const cur = currency || "USD";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(num);
  };


  const refresh = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getMyCart(token);
      const list = Array.isArray(data) ? data : [];
      setItems(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    refresh();

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "true") {
      toast.success("Payment successful! You can now send your book to print.");
      // Give Stripe webhook a moment to mark the cart paid, then refresh
      setTimeout(() => {
        refresh();
      }, 1500);
      window.history.replaceState({}, "", "/cart");
    } else if (payment === "false") {
      toast.error("Payment was cancelled.");
      window.history.replaceState({}, "", "/cart");
    }
  }, []);

  return (
    <PrivateRoute>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Your Cart</h1>
            <p className="text-sm text-slate-600">{items.length} item{items.length !== 1 ? "s" : ""} ready to review</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>Back</Button>
          </div>
        </div>
     {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-6 border rounded-xl bg-white animate-pulse">
                <div className="h-5 w-40 bg-slate-200 rounded" />
                <div className="mt-4 h-4 w-64 bg-slate-200 rounded" />
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="h-24 bg-slate-100 rounded" />
                  <div className="h-24 bg-slate-100 rounded" />
                  <div className="h-24 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-10 border rounded-2xl bg-white text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6h15l-1.5 9h-12L6 6z" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="20" r="1" fill="#475569" />
                <circle cx="18" cy="20" r="1" fill="#475569" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-800">Your cart is empty</h2>
            <p className="mt-1 text-slate-600">Add a book from the builder to get started.</p>
            <div className="mt-6">
              <Button onClick={() => router.push("/dashboard/book-builder")}>Go to Book Builder</Button>
            </div>
          </div>
        )}
    
          {!loading && items.length > 0 && (
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it._id} className="p-6 border rounded-xl bg-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-semibold">
                      {(it.title || it.bookId || "?").toString().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-lg leading-tight truncate">{it.title ? it.title : (it.bookId ? `Book: ${it.bookId}` : "Custom print order")}</div>
                      <div className="mt-1 text-sm text-slate-600 truncate">{it.name || it.shipping_address?.name || ""}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm font-medium text-slate-700">Shipping Address</div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        <div>{it.shipping_address?.street1}</div>
                        <div>{it.shipping_address?.city}, {it.shipping_address?.state_code} {it.shipping_address?.postcode}</div>
                        <div>{it.shipping_address?.country_code} • {it.shipping_address?.phone_number}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">Shipping & POD</div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700 wrap-break-word">
                        <div>Option: <span className="font-medium">{it.shipping_option || "-"}</span></div>
                        <div>POD Package: <span className="font-medium">{it.pod_package_id || "-"}</span></div>
                        {it.trim_code && (
                          <div>Trim: <span className="font-medium">{it.trim_code}</span></div>
                        )}
                        <div>Quantity: <span className="font-semibold">{it.quantity}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${it.status === 'ready' ? 'bg-green-100 text-green-700' : it.status === 'pending' ? 'bg-amber-100 text-amber-700' : it.status === 'unpaid' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{it.status === 'unpaid' ? 'Unpaid by admin' : (it.status || 'pending')}</span>
                  <div className="text-right">
                    <div className="text-xl font-semibold">{formatMoney(typeof it.total_price === 'number' ? it.total_price : Number(it.total_price || 0), it.currency)}</div>
                    <div className="text-sm text-slate-500">Qty: {it.quantity}</div>
                  </div>
                    <div className="flex gap-2 flex-wrap">
                    {it.pdfUrl ? (
                      <Button variant="outline" onClick={() => window.open(it.pdfUrl, "_blank", "noopener,noreferrer")}>
                        Open PDF
                      </Button>
                    ) : (
                      <Button variant="outline" disabled>PDF missing</Button>
                    )}
                    {it.coverPdfUrl ? (
                      <Button variant="outline" onClick={() => window.open(it.coverPdfUrl, "_blank", "noopener,noreferrer")}>
                        Open Cover
                      </Button>
                    ) : (
                      <Button variant="outline" disabled>Cover missing</Button>
                    )}
                    {it.status === 'ready' && !it.paymentPaid ? (
                      <Button
                        className="bg-[#1f6feb] text-white"
                        onClick={async () => {
                          if (!it._id) return;
                          const token = localStorage.getItem("token");
                          try {
                            setSendingId(it._id);
                            // Create Stripe checkout session for this cart item
                            const origin = window.location.origin;
                            const res = await fetch(`${serverBaseUrl}/user/cart/${it._id}/checkout`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                success_url: `${origin}/cart?payment=true`,
                                cancel_url: `${origin}/cart?payment=false`,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.message || "Failed to create checkout session");
                            const sessionId = data?.response?.data?.id;
                            const stripe = await loadStripe(stripePublicKey|| '');
                            if (!stripe) throw new Error("Stripe failed to load");
                            const result = await stripe.redirectToCheckout({ sessionId });
                            if (result.error) {
                              console.error(result.error);
                              toast.error(result.error.message || "Stripe redirect failed");
                            }
                          } catch (e: any) {
                            console.error(e);
                            toast.error(e?.message || "Failed to start checkout");
                          } finally {
                            setSendingId(null);
                          }
                        }}
                        disabled={sendingId === it._id}
                      >
                        {sendingId === it._id ? "Redirecting…" : "Pay"}
                      </Button>
                    ) : null}

                    {it.status === 'ready' && it.paymentPaid ? (
                      <Button
                        className="bg-green-600 text-white"
                        onClick={async () => {
                          if (!it._id) return;
                          const token = localStorage.getItem("token");
                          try {
                            setSendingId(it._id);
                            const res = await fetch(`${serverBaseUrl}/user/cart/${it._id}/send`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.message || "Failed to send to print");
                            await refresh();
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setSendingId(null);
                          }
                        }}
                        disabled={sendingId === it._id}
                      >
                        {sendingId === it._id ? "Sending…" : "Send to Print"}
                      </Button>
                    ) : null}
                      {it.status === 'ready' && !it.paymentPaid && (
                        <Button
                          variant="destructive"
                          onClick={async () => {
                            if (!it._id) return;
                            const ok = window.confirm("Remove this item from your cart?");
                            if (!ok) return;
                            const token = localStorage.getItem("token");
                            try {
                              setDeletingId(it._id);
                              const res = await fetch(`${serverBaseUrl}/user/cart/${it._id}`, {
                                method: "DELETE",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data?.message || "Failed to remove  cart item");
                              await refresh();
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          disabled={deletingId === it._id}
                        >
                          {deletingId === it._id ? "Removing…" : "Remove"}
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </PrivateRoute>
  );
}
