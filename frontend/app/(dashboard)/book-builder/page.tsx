"use client";
import {
  luluOptions,
  generatePodPackageId,
  extractTrimCodeFromPod,
  getTrimLabel,
} from "@/utils/luluConfig";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PrivateRoute } from "@/utils/RouteProtection";
import { Button } from "@/components/ui/Button";
import {
  getBook,
  reorderBook,
  removeStoryFromBook,
  generateBookPdf,
  updateBookTitle,
  sendToLulu,
  calculatePrintCost,
} from "@/utils/bookDraft";
import { createCartItem } from "@/utils/cartClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { handleSessionExpiry } from "@/utils/handleSessionExpiry";
import TrialBanner from "@/components/ui/TrialBanner";

const serverBaseUrl = process.env.NEXT_PUBLIC_BACKEND_SERVER_URL;

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type StoryType = {
  _id: string;
  story_title: string;
  read_time: string;
  genre: string;
};

type BookItem = {
  order: number;
  storyId: StoryType; // populated from backend
};

type BookType = {
  _id: string;
  title: string;
  items: BookItem[];
  pdfUrl?: string;
  coverPdfUrl?: string;
  pod_package_id?: string;
  pdf_trim_code?: string;
};

const DRAFT_BOOK_KEY = "draftBookId";

function SortableRow({
  story,
  onRemove,
  onMove,
}: {
  story: StoryType;
  onRemove: (storyId: string) => void;
  onMove?: (storyId: string, direction: "up" | "down") => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: story._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-3 p-4 rounded-xl border bg-white ${
        isDragging ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab select-none px-2 py-1 rounded bg-slate-100"
          title="Drag to reorder"
        >
          ::
        </div>

        <div>
          <div className="font-semibold text-slate-800">
            {story.story_title}
          </div>
          <div className="text-xs text-slate-500">
            {story.genre} • {story.read_time}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => onMove && onMove(story._id, "up")}
          className="text-slate-700 border-slate-200 hover:bg-slate-50"
        >
          ↑
        </Button>
        <Button
          variant="outline"
          onClick={() => onMove && onMove(story._id, "down")}
          className="text-slate-700 border-slate-200 hover:bg-slate-50"
        >
          ↓
        </Button>
        <Button
          variant="outline"
          onClick={() => onRemove(story._id)}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

export default function BookBuilderPage() {
  const sensors = useSensors(useSensor(PointerSensor));

  const [bookId, setBookId] = useState<string | null>(null);
  const [book, setBook] = useState<BookType | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const storyList = useMemo(() => {
    const items = book?.items ?? [];
    return items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((it) => it.storyId)
      .filter((s): s is NonNullable<typeof s> => !!s && typeof s === "object" && typeof s._id === "string");
  }, [book]);

  const storyIds = useMemo(() => storyList.map((s) => s._id), [storyList]);

  const load = async (id: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        return;
      }
      const b = await getBook(id, token);
      setBook(b as any);
      setDraftTitle((b as any)?.title || "");
      const savedPod = (b as any)?.pod_package_id as string | undefined;
      if (savedPod) {
        const savedTrim = extractTrimCodeFromPod(savedPod);
        if (savedTrim) setTrimSize(savedTrim);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load book");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_BOOK_KEY);
    if (!saved) return;
    setBookId(saved);
    load(saved);
  }, []);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = storyIds.indexOf(String(active.id));
    const newIndex = storyIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newList = arrayMove(storyList, oldIndex, newIndex);
    const newIds = newList.map((s) => s._id);

    // optimistic UI update
    setBook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: newList.map((s, idx) => ({
          order: idx + 1,
          storyId: s,
        })),
      };
    });

    try {
      const token = localStorage.getItem("token");
      if (!token || !bookId) return;
      await reorderBook(bookId, newIds, token);
      toast.success("Order updated");
    } catch (e: any) {
      toast.error(e?.message || "Reorder failed");
      // reload to restore correct order
      if (bookId) load(bookId);
    }
  };

  const handleRemove = async (storyId: string) => {
    if (!bookId) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await removeStoryFromBook(bookId, storyId, token);
      toast.success("Removed");

      await load(bookId);
    } catch (e: any) {
      toast.error(e?.message || "Remove failed");
    }
  };

  const moveStory = async (storyId: string, direction: "up" | "down") => {
    if (!bookId || !book) return;
    const list = storyList.slice();
    const idx = list.findIndex((s) => s._id === storyId);
    if (idx === -1) return;
    const newIndex = direction === "up" ? idx - 1 : idx + 1;
    if (newIndex < 0 || newIndex >= list.length) return;

    const newList = arrayMove(list, idx, newIndex);

    // optimistic UI
    setBook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: newList.map((s, i) => ({ storyId: s, order: i + 1 })),
      };
    });

    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const newIds = newList.map((s) => s._id);
      await reorderBook(bookId, newIds, token);
      toast.success("Order updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update order");
      // reload to restore
      await load(bookId);
    }
  };

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [quickGenerating, setQuickGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const router = useRouter();
  const [hasPaidSubscription, setHasPaidSubscription] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validationId, setValidationId] = useState<string | null>(null);
  // Lulu payload inputs
  const [contactEmail, setContactEmail] = useState("zeeshan@example.com");
  const [quantity, setQuantity] = useState<number>(1);
  const [shippingLevel, setShippingLevel] = useState("MAIL");
  const [shippingOption, setShippingOption] = useState("MAIL");
  const [trimSize, setTrimSize] = useState<string>(
    luluOptions.defaults.trimSize || "0600X0900",
  );
  const [binding, setBinding] = useState<string>(
    luluOptions.bindings[1].code as string,
  );
  const [interiorColor, setInteriorColor] = useState<string>(
    luluOptions.interiorColors[3].code as string,
  );
  const [paperType, setPaperType] = useState<string>(
    luluOptions.paperTypes[1].code as string,
  );
  const [coverFinish, setCoverFinish] = useState<string>(
    luluOptions.coverFinishes[0].code as string,
  );
  const [podPackageId, setPodPackageId] = useState<string>(() =>
    generatePodPackageId({
      size: luluOptions.defaults.trimSize as any,
      color: luluOptions.interiorColors[3].code as any,
      binding: luluOptions.bindings[1].code as any,
      paper: luluOptions.paperTypes[1].code as any,
      finish: luluOptions.coverFinishes[0].code as any,
    }),
  );

  useEffect(() => {
    setPodPackageId(
      generatePodPackageId({
        size: trimSize as any,
        color: interiorColor as any,
        binding: binding as any,
        paper: paperType as any,
        finish: coverFinish as any,
      }),
    );
  }, [trimSize, binding, interiorColor, paperType, coverFinish]);

  const hasPdf = Boolean((book && book.pdfUrl) || pdfUrl);

  /** True when UI POD selection no longer matches the generated interior PDF. */
  const pdfOutOfSync = useMemo(() => {
    if (!hasPdf) return false;
    const generatedPod = book?.pod_package_id;
    if (!generatedPod) return true;
    return generatedPod !== podPackageId;
  }, [hasPdf, book?.pod_package_id, podPackageId]);

  useEffect(() => {
    let cancelled = false;

    const fetchSubscription = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token || !serverBaseUrl) {
          if (!cancelled) {
            setHasPaidSubscription(false);
            setSubscriptionChecked(true);
          }
          return;
        }

        const response = await fetch(
          `${serverBaseUrl}/user/plan/subscription`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        let data: any = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (cancelled) return;

        if (response.ok) {
          const expiry = data?.response?.expiryDate;
          if (expiry) {
            const expiryDate = new Date(expiry);
            setHasPaidSubscription(expiryDate > new Date());
          } else {
            // If backend doesn't provide an expiry, assume active.
            setHasPaidSubscription(true);
          }
        } else {
          // 404 is expected when the user has no paid subscription (trial users included)
          if (handleSessionExpiry(data?.message, router)) return;
          setHasPaidSubscription(false);
        }
      } catch {
        if (!cancelled) setHasPaidSubscription(false);
      } finally {
        if (!cancelled) setSubscriptionChecked(true);
      }
    };

    fetchSubscription();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const fetchTrial = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token || !serverBaseUrl) return;

        const response = await fetch(`${serverBaseUrl}/user/plan/trial`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          if (handleSessionExpiry(data?.message, router)) return;
          return;
        }

        setTrialActive(Boolean(data?.response?.trialActive));
        setTrialEndDate(data?.response?.trialEndDate ?? null);
      } catch {
        // ignore
      }
    };

    fetchTrial();
    return () => {
      cancelled = true;
    };
  }, [router]);
  const [coverUrl, setCoverUrl] = useState("");
  const [customCoverWidth, setCustomCoverWidth] = useState<string>("");
  const [customCoverHeight, setCustomCoverHeight] = useState<string>("");
  const [customCoverUnit, setCustomCoverUnit] = useState<string>("in");
  // Cover modal states
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverAuthor, setCoverAuthor] = useState<string>("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(32);
  const [shippingAddress, setShippingAddress] = useState({
    city: "Washington",
    country_code: "US",
    name: "Zeeshan",
    phone_number: "+1 453454",
    postcode: "20450",
    state_code: "DC",
    street1: "1600 Pennsylvania Ave NW",
  });
  const [costEstimate, setCostEstimate] = useState<any>(null);

  const requirePaidSubscriptionForPdf = () => {
    if (!subscriptionChecked) {
      toast.info("Checking your subscription...");
      return false;
    }

    if (!hasPaidSubscription) {
      toast.error("Please select a plan to generate or preview your PDF");
      router.push("/select-plan");
      return false;
    }

    return true;
  };

  const handleGeneratePdf = async () => {
    if (!bookId) return;

    if (!requirePaidSubscriptionForPdf()) return;

    // open modal to ask for cover image and author name
    setShowCoverModal(true);
  };

  const readFileAsDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const confirmGenerate = async () => {
    if (!bookId) return;

    if (!requirePaidSubscriptionForPdf()) {
      setShowCoverModal(false);
      return;
    }

    setShowCoverModal(false);
    setGenerating(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        return;
      }

      let coverDataUrl: string | undefined = undefined;
      if (coverFile) {
        coverDataUrl = await readFileAsDataUrl(coverFile);
      }

      let audioDataUrl: string | undefined = undefined;
      if (audioFile) {
        audioDataUrl = await readFileAsDataUrl(audioFile);
      }

      const url = await generateBookPdf(
        bookId,
        token,
        podPackageId,
        customCoverWidth && customCoverWidth.trim() !== ""
          ? customCoverWidth.trim()
          : undefined,
        customCoverHeight && customCoverHeight.trim() !== ""
          ? customCoverHeight.trim()
          : undefined,
        customCoverUnit && customCoverUnit.trim() !== ""
          ? customCoverUnit.trim()
          : undefined,
        coverDataUrl,
        coverAuthor && coverAuthor.trim() !== ""
          ? `By ${coverAuthor.trim()}`
          : undefined,
        audioDataUrl,
      );
      setPdfUrl(url);
      // refresh book state so `book.pdfUrl` reflects the newly generated PDF
      await load(bookId);
      console.log("Generated PDF URL:", url);
      toast.success("PDF generated");
    } catch (e: any) {
      toast.error(e?.message || "PDF generation failed");
    } finally {
      setGenerating(false);
      setCoverFile(null);
      setCoverPreview(null);
      setCoverAuthor("");
      setAudioFile(null);
      setAudioFileName(null);
    }
  };

  const handleQuickGenerate = async () => {
    if (!bookId) return;

    if (!requirePaidSubscriptionForPdf()) return;

    setQuickGenerating(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return toast.error("Please login again");

      const url = await generateBookPdf(bookId, token, podPackageId);
      setPdfUrl(url);
      await load(bookId);
      toast.success("PDF generated");
    } catch (e: any) {
      toast.error(e?.message || "PDF generation failed");
    } finally {
      setQuickGenerating(false);
    }
  };

  const cancelGenerate = () => {
    setShowCoverModal(false);
    setCoverFile(null);
    setCoverPreview(null);
    setCoverAuthor("");
    setAudioFile(null);
    setAudioFileName(null);
  };

  const handleAddToCart = async () => {
    if (!bookId) return;

    if (!hasPdf) {
      toast.error("Generate the PDF before ordering.");
      return;
    }
    if (pdfOutOfSync) {
      const generatedTrim = book?.pdf_trim_code || extractTrimCodeFromPod(book?.pod_package_id || "");
      const selectedTrim = extractTrimCodeFromPod(podPackageId);
      toast.error(
        `Book format changed (${getTrimLabel(selectedTrim || "")}) but the PDF was generated for ${getTrimLabel(generatedTrim || "another size")}. Regenerate the PDF, then add to cart.`,
      );
      return;
    }

    setAddingToCart(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return toast.error("Please login again");

      // basic shipping validation
      const requiredFields = [
        shippingAddress.city,
        shippingAddress.country_code,
        shippingAddress.postcode,
        shippingAddress.state_code,
        shippingAddress.street1,
        shippingAddress.phone_number,
      ];
      if (requiredFields.some((f) => !f || String(f).trim() === "")) {
        toast.error(
          "Please fill required shipping details before adding to cart",
        );
        return;
      }

      // validate phone format: <country code> <number> e.g. +92 6868, 1 787979
      const phonePatternCart = /^\+?\d{1,3} \d{4,15}$/;
      if (
        !phonePatternCart.test(
          String(shippingAddress.phone_number || "").trim(),
        )
      ) {
        toast.error(
          "Phone number must be in format: +1 6868... or 1 787979... (country code, space, number)",
        );
        return;
      }
      console.log("Book before PDF generation:", book);
      // ensure PDF exists
      if (!book?.coverPdfUrl) {
        const url = await generateBookPdf(bookId, token);
        setPdfUrl(url);
        console.log("Book after PDF generation:", book);
        await load(bookId);
      }
      console.log("Book after PDF generation:", book);

      const interiorSource = (book as any)?.pdfUrl || pdfUrl;
      if (!interiorSource)
        throw new Error("No interior PDF available to validate");

      const lib = await import("@/utils/bookDraft");

      // validate interior
      // const interiorResp = await lib.validateInterior(bookId, token, interiorSource, podPackageId);
      // let interiorFinal = interiorResp;
      // if (interiorResp && interiorResp.id) {
      //   const max = 12;
      //   for (let i = 0; i < max; i++) {
      //     const s = await lib.getValidationStatus(bookId, token, String(interiorResp.id));
      //     interiorFinal = s;
      //     const st = (s?.status || s?.state || "").toString().toUpperCase();
      //     if (s?.errors && Object.keys(s.errors).length > 0) break;
      //     if (st && !["VALIDATING", "NORMALIZING", "PROCESSING"].includes(st)) break;
      //     await new Promise((r) => setTimeout(r, 2000));
      //   }
      // }
      // if (interiorFinal?.errors && Object.keys(interiorFinal.errors).length > 0) {
      //   throw new Error("Interior validation failed: " + JSON.stringify(interiorFinal.errors));
      // }

      // console.log("Book:", book);

      const interiorResp = await lib.validateInterior(
        bookId,
        token,
        interiorSource,
        podPackageId,
      );
      let interiorFinal = interiorResp;

      const terminalStates = [
        "VALIDATED",
        "COMPLETED",
        "ERROR",
        "FAILED",
        "REJECTED",
      ];

      if (interiorResp && interiorResp.id) {
        const max = 10; // Increased max attempts to account for longer validation times
        for (let i = 0; i < max; i++) {
          const s = await lib.getValidationStatus(
            bookId,
            token,
            String(interiorResp.id),
          );
          interiorFinal = s;

          if (s?.errors && Object.keys(s.errors).length > 0) break;

          const st = (s?.status || s?.state || "").toString().toUpperCase();
          // FIX: Break ONLY if we hit a finished state
          if (terminalStates.includes(st)) break;

          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (
        interiorFinal?.errors &&
        Object.keys(interiorFinal.errors).length > 0
      ) {
        throw new Error(
          "Interior validation failed: " + JSON.stringify(interiorFinal.errors),
        );
      }
      // validate cover (ensure cover PDF exists first)
      // const coverSource = (book as any)?.coverPdfUrl || coverUrl;
      // if (!coverSource) {
      //   // try regenerating PDFs to get a cover
      //   const url = await generateBookPdf(bookId, token, podPackageId);
      //   setPdfUrl(url);
      //   await load(bookId);
      // }

      const finalCoverSource = (book as any)?.coverPdfUrl || coverUrl;
      if (!finalCoverSource)
        throw new Error("No cover PDF available to validate");

      // derive interior page count from validation result or fallback
      const interiorPageCount = Number(
        interiorFinal?.page_count || interiorFinal?.pages || pageCount || 0,
      );
      if (!interiorPageCount || interiorPageCount <= 0) {
        throw new Error(
          "Unable to determine interior page count for cover validation",
        );
      }
      console.log(
        "cobersource:",
        finalCoverSource,
        "interiorPageCount:",
        interiorPageCount,
      );
      const coverResp = await lib.validateCover(bookId, token, {
        source_url: finalCoverSource,
        pod_package_id: podPackageId,
        interior_page_count: interiorPageCount,
      });
      let coverFinal = coverResp;
      if (coverResp && coverResp.id) {
        const max = 12;
        for (let i = 0; i < max; i++) {
          const s = await lib.getCoverValidationStatus(
            bookId,
            token,
            String(coverResp.id),
          );
          coverFinal = s;
          const st = (s?.status || s?.state || "").toString().toUpperCase();
          if (s?.errors && Object.keys(s.errors).length > 0) break;
          if (st && !["VALIDATING", "NORMALIZING", "PROCESSING"].includes(st))
            break;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (coverFinal?.errors && Object.keys(coverFinal.errors).length > 0) {
        throw new Error(
          "Cover validation failed: " +
            JSON.stringify(coverFinal.errors) +
            ". Please choose the correct binding type and generate the book again.",
        );
      }

      // calculate cost
      const costPayload = {
        line_items: [
          {
            page_count: Number(pageCount),
            pod_package_id: podPackageId,
            quantity: Number(quantity),
          },
        ],
        shipping_address: {
          city: shippingAddress.city,
          country_code: shippingAddress.country_code,
          phone_number: shippingAddress.phone_number,
          postcode: shippingAddress.postcode,
          state_code: shippingAddress.state_code,
          street1: shippingAddress.street1,
        },
        shipping_option: shippingOption,
      };

      const cost = await calculatePrintCost(bookId, token, costPayload);

      // compute total
      // const totalTax = Number(cost.total_tax || 0);
      // const totalIncl = Number(cost.total_cost_incl_tax || 0);
      // const fulfillmentTax = Number(cost.fulfillment_cost?.total_tax || 0);
      // const shippingIncl = Number(cost.shipping_cost?.total_cost_incl_tax || 0);
      // const discount = Number(cost.total_discount_amount || 0);
      // const totalPrice = totalTax + totalIncl + fulfillmentTax + shippingIncl - discount;

      const salesTax = Number(cost.total_tax || 0);
      const fulfillment_fee = Number(
        cost.fulfillment_cost?.total_cost_excl_tax || 0,
      );
      const shipping_cost = Number(
        cost.shipping_cost?.total_cost_excl_tax || 0,
      );
      const sub_total = Number(cost.line_item_costs[0]?.unit_tier_cost || 0);
      const discount = Number(cost.total_discount_amount || 0);
      const totalPrice =
        salesTax + sub_total + fulfillment_fee + shipping_cost - discount;
      const finalprice = cost.total_cost_incl_tax;
      const cartPayload = {
        title: book?.title || "",
        name: shippingAddress.name || shippingAddress?.name || "",
        email: contactEmail || "",
        pdfUrl: (book as any)?.pdfUrl || pdfUrl,
        coverPdfUrl: (book as any)?.coverPdfUrl || undefined,
        shipping_address: costPayload.shipping_address,
        shipping_option: shippingOption,
        pod_package_id: podPackageId,
        quantity: Number(quantity),
        total_price: finalprice,
        currency: cost.currency || "",
      };

      await createCartItem(token, cartPayload);
      toast.success("Added to cart");
      router.push("/cart");
    } catch (e: any) {
      toast.error(e?.message || "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleCalculateCost = async () => {
    if (!bookId) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        return;
      }

      // validate minimal fields (give clear messages)
      const missingTop: string[] = [];
      if (!podPackageId) missingTop.push("POD Package ID");
      // if (!pageCount) missingTop.push("Page Count");
      if (!quantity) missingTop.push("Quantity");
      if (missingTop.length > 0) {
        toast.error(`Please provide: ${missingTop.join(", ")}`);
        return;
      }

      // require full shipping address and shipping option with clear messages
      const missingShipping: string[] = [];
      if (!shippingAddress.city || String(shippingAddress.city).trim() === "")
        missingShipping.push("City");
      if (
        !shippingAddress.country_code ||
        String(shippingAddress.country_code).trim() === ""
      )
        missingShipping.push("Country Code");
      if (
        !shippingAddress.postcode ||
        String(shippingAddress.postcode).trim() === ""
      )
        missingShipping.push("Postcode");
      if (
        !shippingAddress.state_code ||
        String(shippingAddress.state_code).trim() === ""
      )
        missingShipping.push("State Code");
      if (
        !shippingAddress.street1 ||
        String(shippingAddress.street1).trim() === ""
      )
        missingShipping.push("Street Address");
      if (
        !shippingAddress.phone_number ||
        String(shippingAddress.phone_number).trim() === ""
      )
        missingShipping.push("Phone Number");
      if (!shippingOption || String(shippingOption).trim() === "")
        missingShipping.push("Shipping Option");

      if (missingShipping.length > 0) {
        toast.error(`Missing shipping fields: ${missingShipping.join(", ")}`);
        return;
      }

      // validate phone format: <country code> <number> e.g. +92 6868, 1 787979
      const phonePattern = /^\+?\d{1,3} \d{4,15}$/;
      if (!phonePattern.test(String(shippingAddress.phone_number).trim())) {
        toast.error(
          "Phone number must be in format: +92 6868 or 1 787979 (country code, space, number)",
        );
        return;
      }

      const payload = {
        line_items: [
          {
            page_count: Number(pageCount),
            pod_package_id: podPackageId,
            quantity: Number(quantity),
          },
        ],
        shipping_address: {
          city: shippingAddress.city,
          country_code: shippingAddress.country_code,
          phone_number: shippingAddress.phone_number,
          postcode: shippingAddress.postcode,
          state_code: shippingAddress.state_code,
          street1: shippingAddress.street1,
        },
        shipping_option: shippingOption,
      };

      const cost = await calculatePrintCost(bookId, token, payload);
      setCostEstimate(cost);
      toast.success("Cost estimate fetched");
    } catch (e: any) {
      toast.error(e?.message || "Failed to fetch cost estimate");
    }
  };

  // Validate interior then cover sequentially, with polling for status
  const handleValidateAll = async () => {
    if (!bookId) return;
    setValidating(true);
    setValidationResult(null);

    setValidationId(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) return toast.error("Please login again");

      // Ensure interior PDF exists
      if (!book?.pdfUrl) {
        await generateBookPdf(bookId, token);
        await load(bookId);
      }

      const interiorSource = (book as any)?.pdfUrl || pdfUrl;
      if (!interiorSource)
        throw new Error("No interior PDF available to validate");

      const lib = await import("@/utils/bookDraft");

      // Start interior validation
      const interiorResp = await lib.validateInterior(
        bookId,
        token,
        interiorSource,
      );
      setValidationResult(interiorResp);
      if (interiorResp && interiorResp.id)
        setValidationId(String(interiorResp.id));

      // Poll interior status until not in-progress or until errors
      const poll = async (
        fn: (b: string, t: string, id: string) => Promise<any>,
        id: string,
      ) => {
        let last = null;
        const max = 12;
        for (let i = 0; i < max; i++) {
          const s = await fn(bookId, token, id);
          last = s;
          const st = (s?.status || s?.state || "").toString().toUpperCase();
          if (s?.errors && Object.keys(s.errors).length > 0) return s;
          if (st && !["VALIDATING", "NORMALIZING", "PROCESSING"].includes(st))
            return s;
          await new Promise((r) => setTimeout(r, 2000));
        }
        return last;
      };

      const finalInterior = await poll(
        lib.getValidationStatus,
        String(interiorResp.id),
      );
      setValidationResult(finalInterior);
      if (
        finalInterior?.errors &&
        Object.keys(finalInterior.errors).length > 0
      ) {
        throw new Error(
          "Interior validation failed: " + JSON.stringify(finalInterior.errors),
        );
      }

      // cover validation removed (only interior validation performed)
      toast.success("Interior validated successfully");
    } catch (err: any) {
      console.error("ValidateAll error:", err);
      toast.error(err?.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (!validationResult) return;
    try {
      const msg =
        validationResult.message ||
        validationResult.status ||
        validationResult.state ||
        (validationResult.errors
          ? JSON.stringify(validationResult.errors)
          : JSON.stringify(validationResult));
      const hasErrors =
        validationResult.errors &&
        Object.keys(validationResult.errors).length > 0;
      if (hasErrors) toast.error(msg);
      else toast.success(msg);
    } catch (e: any) {
      toast.error("Validation result received");
    }
  }, [validationResult]);

  // cover validation status checks removed

  const computedTotal = useMemo(() => {
    if (!costEstimate) return null;
    const salesTax = Number(costEstimate.total_tax || 0);
    const fulfillment_fee = Number(
      costEstimate.fulfillment_cost?.total_cost_excl_tax || 0,
    );
    const shipping_cost = Number(
      costEstimate.shipping_cost?.total_cost_excl_tax || 0,
    );
    const sub_total = Number(
      costEstimate.line_item_costs[0]?.unit_tier_cost || 0,
    );
    const discount = Number(costEstimate.total_discount_amount || 0);
    console.log("Cost breakdown:", {
      salesTax,
      fulfillment_fee,
      shipping_cost,
      sub_total,
      discount,
    });
    return salesTax + sub_total + fulfillment_fee + shipping_cost - discount;
  }, [costEstimate]);

  return (
    <PrivateRoute>
      <div className="max-w-4xl mx-auto px-4 py-10">
        {!hasPaidSubscription && trialActive && (
          <div className="mb-4">
            <TrialBanner trialEndDate={trialEndDate} />
          </div>
        )}
        {showCoverModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden border p-6">
              <h3 className="text-lg font-semibold mb-1">
                Title Page Cover — Generate PDF
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Upload an image and optional author name to appear on the book's
                title page.
              </p>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="cover-upload"
                    className="block text-sm text-slate-600 mb-2"
                  >
                    Title-page cover image (optional)
                  </label>

                  <div
                    onClick={() =>
                      document.getElementById("cover-upload")?.click()
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        document.getElementById("cover-upload")?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="mt-2 flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-slate-400 bg-slate-50"
                  >
                    {!coverPreview && (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-slate-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0016.414 6L13 2.586A2 2 0 0011.586 2H4z" />
                        </svg>
                        <div className="text-sm text-slate-600">
                          Click or drag image to upload
                        </div>
                        <div className="text-xs text-slate-400">
                          PNG, JPG, GIF — up to 5MB
                        </div>
                      </>
                    )}

                    {coverPreview && (
                      <div className="w-full flex flex-col items-center justify-center">
                        <img
                          src={coverPreview}
                          alt="Cover preview"
                          className="max-h-44 object-contain rounded"
                        />
                        <div className="text-xs text-slate-500 mt-2">
                          Preview — this image will appear on the book title
                          page
                        </div>
                      </div>
                    )}

                    <input
                      id="cover-upload"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files && e.target.files[0];
                        if (!f) return;
                        if (f.size > 5 * 1024 * 1024) {
                          toast.error("File too large (max 5MB)");
                          e.currentTarget.value = "";
                          return;
                        }
                        setCoverFile(f);
                        try {
                          const data = await readFileAsDataUrl(f);
                          setCoverPreview(data);
                        } catch (err) {
                          toast.error("Failed to read file");
                        }
                      }}
                      className="hidden"
                    />
                  </div>

                  {coverPreview && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCoverFile(null);
                          setCoverPreview(null);
                          const el = document.getElementById(
                            "cover-upload",
                          ) as HTMLInputElement | null;
                          if (el) el.value = "";
                        }}
                        className="px-3 py-1 border rounded bg-white text-slate-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-slate-600">
                    Author name (optional)
                  </label>
                  <input
                    value={coverAuthor}
                    onChange={(e) => setCoverAuthor(e.target.value)}
                    className="w-full p-2 border rounded mt-2"
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Will appear on the title page beneath the cover image. Leave
                    blank to use default attribution.
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-600">
                    Audio file (optional)
                  </label>
                  <div className="text-xs text-slate-400 mt-1 mb-2">
                    Attach an audio file and a QR code will be added to the book
                    so readers can scan and listen.
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="audio-upload"
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0];
                        if (!f) return;
                        if (f.size > 25 * 1024 * 1024) {
                          toast.error("Audio file too large (max 25MB)");
                          e.currentTarget.value = "";
                          return;
                        }
                        setAudioFile(f);
                        setAudioFileName(f.name);
                      }}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  {audioFileName && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                      <span className="text-sm text-blue-700 truncate flex-1">
                        🎵 {audioFileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAudioFile(null);
                          setAudioFileName(null);
                          const el = document.getElementById(
                            "audio-upload",
                          ) as HTMLInputElement | null;
                          if (el) el.value = "";
                        }}
                        className="px-2 py-1 text-xs border rounded bg-white text-slate-700 hover:bg-red-50 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={cancelGenerate}>
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmGenerate}
                    className="bg-blue-600 text-white"
                  >
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-semibold text-slate-800">
            Story Book Builder
          </h1>

          <div className="flex gap-2">
            <Button variant="outline">
              <Link href={"/story"}>Back to Stories</Link>
            </Button>

            <Button
              onClick={() => router.push("/cart")}
              className="bg-green-600 text-white"
            >
              Go to Cart
            </Button>
          </div>
        </div>

        {!bookId && (
          <div className="p-6 border rounded-xl bg-white">
            <p className="text-slate-700">
              No draft book found. Please add stories to a book first.
            </p>
          </div>
        )}

        {bookId && !book && loading && (
          <p className="text-slate-600">Loading…</p>
        )}

        {book && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border bg-white">
              <div className="text-sm text-slate-500">StoryBook Title</div>
              <div className="text-lg font-semibold flex items-center gap-3">
                {!editingTitle ? (
                  <>
                    <span>{book.title}</span>
                    <Button
                      variant="outline"
                      onClick={() => setEditingTitle(true)}
                      className="text-sm px-2 py-1"
                    >
                      Edit
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      className="w-full p-2 border rounded"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      maxLength={50}
                    />
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-400 mr-2">
                        {draftTitle.trim().length}/50
                      </div>
                      <Button
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem("token");
                            if (!token)
                              return toast.error("Please login again");
                            const trimmed = draftTitle.trim();
                            if (trimmed.length === 0)
                              return toast.error("Title cannot be empty");
                            if (trimmed.length > 50)
                              return toast.error(
                                "Title must be 50 characters or less",
                              );
                            await updateBookTitle(book._id, trimmed, token);
                            await load(bookId!);
                            setEditingTitle(false);
                            toast.success("Book title updated");
                          } catch (err: any) {
                            toast.error(
                              err?.message || "Failed to update title",
                            );
                          }
                        }}
                        className="px-3 py-1"
                        disabled={draftTitle.trim().length === 0}
                      >
                        Save
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingTitle(false);
                        setDraftTitle(book.title);
                      }}
                      className="px-3 py-1"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Stories selected: {storyList.length}
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={storyIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {storyList.map((story) => (
                    <SortableRow
                      key={story._id}
                      story={story}
                      onRemove={handleRemove}
                      onMove={moveStory}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="mb-3 flex items-center gap-2">
              <Button
                onClick={handleQuickGenerate}
                disabled={quickGenerating || !bookId || storyList.length === 0}
                className="bg-[#457B9D] text-white"
              >
                {quickGenerating ? "Generating..." : "Quick Generate PDF"}
              </Button>
              <div className="relative group">
                <button
                  type="button"
                  className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center hover:bg-slate-300 transition-colors cursor-pointer"
                  aria-label="Info about Quick Generate"
                >
                  i
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                  <p className="font-semibold mb-1">Quick Generate PDF</p>
                  <p>
                    Generate quick preview PDF (no cover image or extra
                    details).
                  </p>
                  <p className="mt-1">
                    Click the button and wait for it to return back to its blue
                    color. Then scroll down and click &quot;Preview PDF&quot;.
                  </p>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-800"></div>
                </div>
              </div>
            </div>

            {subscriptionChecked && !hasPaidSubscription && (
              <div className="p-4 rounded-xl border bg-white space-y-2">
                <div className="font-semibold text-slate-800">
                  Want a hardcopy of your book?
                </div>
                <div className="text-sm text-slate-600">
                  Buy a subscription plan to enable hardcopy ordering.
                </div>
                <div className="pt-1">
                  <Button
                    onClick={() => router.push("/select-plan")}
                    className="bg-[#457B9D] text-white"
                  >
                    View Plans
                  </Button>
                </div>
              </div>
            )}

            {hasPaidSubscription && (
              <div className="p-4 rounded-xl border bg-white space-y-3">
                <div className="font-semibold text-slate-800">
                  Print Settings
                </div>
                <div className="text-xs text-slate-500">
                  Fields marked <span className="text-red-600">*</span> are
                  required
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Contact Email <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="you@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="text-sm text-slate-500">
                      Book Size <span className="text-red-600">*</span>
                    </div>
                    <select
                      className="p-2 border rounded w-full"
                      value={trimSize}
                      onChange={(e) => setTrimSize(e.target.value)}
                    >
                      {luluOptions.sizes.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      No of Copies <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="1"
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                    />
                  </div>
                  {/* <input
                  className="p-2 border rounded"
                  placeholder="Interior Page Count"
                  type="number"
                  min={1}
                  value={pageCount}
                  onChange={(e) => setPageCount(Number(e.target.value) || 1)}
                /> */}
                  {/* <div>
                  <label className="block text-xs text-slate-600 mb-1">Shipping Level</label>
                  <select
                    className="p-2 border rounded w-full"
                    value={shippingLevel}
                    onChange={(e) => {
                      setShippingLevel(e.target.value);
                      setShippingOption(e.target.value);
                    }}
                    aria-label="Shipping Level"
                  >
                    <option value="MAIL">MAIL</option>
                    <option value="PRIORITY_MAIL">PRIORITY_MAIL</option>
                    <option value="GROUND_HD">GROUND_HD</option>
                    <option value="GROUND_BUS">GROUND_BUS</option>
                    <option value="GROUND">GROUND</option>
                    <option value="EXPEDITED">EXPEDITED</option>
                    <option value="EXPRESS">EXPRESS</option>
                  </select>
                </div> */}
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Shipping Option <span className="text-red-600">*</span>
                    </label>
                    <select
                      className="p-2 border rounded w-full"
                      value={shippingOption}
                      onChange={(e) => {
                        setShippingOption(e.target.value);
                        setShippingLevel(e.target.value);
                      }}
                      aria-label="Shipping Option"
                    >
                      <option value="MAIL">MAIL</option>
                      <option value="PRIORITY_MAIL">PRIORITY_MAIL</option>
                      <option value="GROUND_HD">GROUND_HD</option>
                      <option value="GROUND_BUS">GROUND_BUS</option>
                      <option value="GROUND">GROUND</option>
                      <option value="EXPEDITED">EXPEDITED</option>
                      <option value="EXPRESS">EXPRESS</option>
                    </select>
                  </div>

                  {/* <div>
                  <label className="block text-xs text-slate-600 mb-1">Trim Size</label>
                  <select
                    className="p-2 border rounded w-full"
                    value={trimSize}
                    onChange={(e) => setTrimSize(e.target.value)}
                  >
                    <option value={luluOptions.defaults.trimSize}>{luluOptions.defaults.trimSize}</option>
                  </select>
                </div> */}

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Binding
                    </label>
                    <select
                      className="p-2 border rounded w-full"
                      value={binding}
                      onChange={(e) => setBinding(e.target.value)}
                    >
                      {luluOptions.bindings.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.label} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Interior Color
                    </label>
                    <select
                      className="p-2 border rounded w-full"
                      value={interiorColor}
                      onChange={(e) => setInteriorColor(e.target.value)}
                    >
                      {luluOptions.interiorColors.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Paper Type
                    </label>
                    <select
                      className="p-2 border rounded w-full"
                      value={paperType}
                      onChange={(e) => setPaperType(e.target.value)}
                    >
                      {luluOptions.paperTypes.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Cover Finish
                    </label>
                    <select
                      className="p-2 border rounded w-full"
                      value={coverFinish}
                      onChange={(e) => setCoverFinish(e.target.value)}
                    >
                      {luluOptions.coverFinishes.map((f) => (
                        <option key={f.code} value={f.code}>
                          {f.label} ({f.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Custom Cover Width
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="e.g. 12.325"
                      value={customCoverWidth}
                      onChange={(e) => setCustomCoverWidth(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Custom Cover Height
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="e.g. 9.25"
                      value={customCoverHeight}
                      onChange={(e) => setCustomCoverHeight(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Cover Unit
                    </label>
                    <select
                      className="p-2 border rounded w-full"
                      value={customCoverUnit}
                      onChange={(e) => setCustomCoverUnit(e.target.value)}
                    >
                      <option value="in">in</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Computed POD Package ID
                    </label>
                    <input
                      className="p-2 border rounded w-full bg-slate-50"
                      value={podPackageId}
                      readOnly
                    />
                  </div>
                  {/* <input
                  className="p-2 border rounded"
                  placeholder="Cover PDF URL (optional)"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                /> */}
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Recipient Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="Full name"
                      value={shippingAddress.name}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Street Address <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="123 Example St"
                      value={shippingAddress.street1}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          street1: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      City <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="City"
                      value={shippingAddress.city}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          city: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      State Code <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="State (e.g., NY)"
                      value={shippingAddress.state_code}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          state_code: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Postcode <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="Postcode"
                      value={shippingAddress.postcode}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          postcode: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Country Code <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="US"
                      value={shippingAddress.country_code}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          country_code: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Phone Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      className="p-2 border rounded w-full"
                      placeholder="+1 555555555"
                      value={shippingAddress.phone_number}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          phone_number: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 flex gap-3">
              {/* <Button
                onClick={() => toast.info("Next phase: Generate PDF")}
                className="bg-[#457B9D] text-white"
              >
                Generate PDF (Next Phase)
              </Button> */}

              {hasPaidSubscription && (
                <Button
                  onClick={handleGeneratePdf}
                  disabled={generating || storyList.length === 0}
                  className="bg-[#457B9D] text-white"
                >
                  {generating ? "Generating..." : "Generate PDF"}
                </Button>
              )}

              {/* <Button
                onClick={handleValidateAll}
                disabled={validating || storyList.length === 0}
                variant="outline"
              >
                {validating ? "Validating..." : "Validate All"}
              </Button>

              <Button
                onClick={handleSendToPrint}
                disabled={sending || storyList.length === 0}
                className="border-slate-200"
              >
                {sending ? "Sending..." : "Send to Print"}
              </Button>

              <Button
                onClick={handleCalculateCost}
                disabled={storyList.length === 0}
                variant="outline"
              >
                Check Price
              </Button> */}
              {((book && (book as any).pdfUrl) || pdfUrl) && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      if (!requirePaidSubscriptionForPdf()) return;
                      window.open(
                        (book && (book as any).pdfUrl) || pdfUrl,
                        "_blank",
                      );
                    }}
                    className="bg-[#457B9D] text-white"
                  >
                    Preview PDF
                  </Button>
                  {/* 
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        const url = (book && (book as any).pdfUrl) || pdfUrl;
                        const a = document.createElement("a");
                        a.href = url || "";
                        a.download = (url && url.split("/").pop()) || "book.pdf";
                        // some browsers require the element to be in the DOM
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      } catch (e) {
                        // fallback: open in new tab
                        window.open((book && (book as any).pdfUrl) || pdfUrl, "_blank");
                      }
                    }}
                    className="text-slate-700 border-slate-200 hover:bg-slate-50"
                  >
                    Download
                  </Button> */}
                </div>
              )}
              {pdfOutOfSync && (
                <p className="w-full text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  The selected book size/binding does not match the generated PDF.
                  Regenerate the PDF after changing format options.
                </p>
              )}
              {hasPaidSubscription && (
                <Button
                  onClick={handleAddToCart}
                  disabled={
                    addingToCart || storyList.length === 0 || pdfOutOfSync || !hasPdf
                  }
                  className="ml-auto bg-green-600 text-white"
                >
                  {addingToCart ? "Adding..." : "Order Book"}
                </Button>
              )}

              {/* Validation results are shown via toasts. */}
            </div>

            {computedTotal !== null && (
              <div className="p-4 rounded-xl border bg-white space-y-2">
                <div className="font-semibold text-slate-800">
                  Estimated Total
                </div>
                <div className="text-lg font-semibold text-slate-800">
                  {costEstimate?.currency || ""} {computedTotal.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PrivateRoute>
  );
}
