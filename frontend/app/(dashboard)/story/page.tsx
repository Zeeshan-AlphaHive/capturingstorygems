"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  BookOpen,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Download,
  Sparkles,
  X,
  Edit3,
  Printer,
  Trash2,
  MoreHorizontal,
  BookPlus,
} from "lucide-react";
import { IoMdCreate } from "react-icons/io";
import { Button } from "@/components/ui/Button";
import { PrivateRoute } from "@/utils/RouteProtection";
import { handleSessionExpiry } from "@/utils/handleSessionExpiry";
import { handleDownload, handlePrintPDF } from "@/utils/downloadStory";
import {
  createDraftBook,
  getBook,
  addStoryToBook,
  getMyBooks,
  BookSummary,
} from "@/utils/bookDraft";
import { MAX_STORY_WORDS, countWords, formatWordCount } from "@/utils/storyLimits";
const serverBaseUrl = process.env.NEXT_PUBLIC_BACKEND_SERVER_URL;

type Story = {
  _id: string;
  story_title: string;
  book_version_title?: string;
  read_time: string;
  genre: string;
  enhanced_story: string;
  heroImageUrl?: string | null;
  heroImageAlignment?: "left" | "center" | "right" | null;
};

type UploadStory = {
  story?: string;
  story_title?: string;
  book_version_title?: string;
};

const Story = () => {
  const router = useRouter();

  const DRAFT_BOOK_KEY = "draftBookId";

  const [draftBookId, setDraftBookId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState<number>(0);
  const [bookLoading, setBookLoading] = useState(false);

  const [loading, setLoading] = useState<string | boolean>(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [editedStory, setEditedStory] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedBookTitle, setEditedBookTitle] = useState("");
  const [editedHeroFile, setEditedHeroFile] = useState<File | null>(null);
  const [editedHeroPreview, setEditedHeroPreview] = useState<string | null>(
    null,
  );
  const [editedHeroAlignment, setEditedHeroAlignment] = useState<
    "left" | "center" | "right"
  >("center");
  const [heroUploading, setHeroUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [storyPages, setStoryPages] = useState<Story[]>([]);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [errors, setErrors] = useState({
    story: "",
  });
  // Book selection / navigation modals
  const [showAddToBookModal, setShowAddToBookModal] = useState(false);
  const [showViewBooksModal, setShowViewBooksModal] = useState(false);
  const [showViewStoriesModal, setShowViewStoriesModal] = useState(false);
  const [booksLoading, setBooksLoading] = useState(false);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [bookToDeleteId, setBookToDeleteId] = useState<string | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [creatingBook, setCreatingBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [currentStoryPage, setCurrentStoryPage] = useState<Story>({
    _id: "",
    story_title: "",
    read_time: "",
    genre: "",
    enhanced_story: "",
  });

  // Pagination helper: builds a compact pagination range with ellipses
  const buildPagination = (
    total: number,
    currentIndex: number,
    maxButtons = 7,
  ) => {
    const current = currentIndex + 1; // convert to 1-based
    if (total <= maxButtons)
      return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | string)[] = [];
    const sideCount = Math.floor((maxButtons - 3) / 2); // buttons around current
    let left = Math.max(2, current - sideCount);
    let right = Math.min(total - 1, current + sideCount);

    // adjust when close to edges
    const needed = maxButtons - 2; // excluding first and last
    const actualRange = right - left + 1;
    if (actualRange < needed) {
      const add = needed - actualRange;
      if (left === 2) {
        right = Math.min(total - 1, right + add);
      } else if (right === total - 1) {
        left = Math.max(2, left - add);
      } else {
        // try to expand both sides
        left = Math.max(2, left - Math.floor(add / 2));
        right = Math.min(total - 1, right + Math.ceil(add / 2));
      }
    }

    pages.push(1);
    if (left > 2) pages.push("...");
    for (let p = left; p <= right; p++) pages.push(p);
    if (right < total - 1) pages.push("...");
    pages.push(total);
    return pages;
  };

  // const handleRevise = async (updatedStory?: string) => {
  //   if (!currentStoryPage) return;
  //   setErrors({
  //     story: "",
  //   });
  //   setLoading("Editing your story");
  //   setDisabled(true);
  //   try {
  //     const token = localStorage.getItem("token");
  //     const body: UploadStory = {};
  //     if (updatedStory !== undefined) {
  //       body.story = updatedStory;
  //     }
  //     const res = await fetch(
  //       `${serverBaseUrl}/user/story/${currentStoryPage._id}`,
  //       {
  //         method: "PUT",
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${token}`,
  //         },
  //         body: JSON.stringify(body),
  //       }
  //     );

  //     const data = await res.json();
  //     if (!res.ok) {
  //       if (handleSessionExpiry(data.message, router, true)) return;
  //       if (res.status === 403) {
  //         const error = typeof data.error;
  //         if (error === "object") {
  //           setErrors(data.error);
  //         }
  //       } else {
  //         toast.error(data.message || "Failed to revise story");
  //       }
  //       return;
  //     }

  //     await loadStoryPages();
  //     toast.success(data.message);
  //     setIsEditing(false);
  //   } catch (err) {
  //     console.error(err);
  //     toast.error("Failed to revise story");
  //   } finally {
  //     setDisabled(false);
  //     setLoading(false);
  //   }
  // };

  const handleRevise = async (
    updatedStory?: string,
    updatedTitle?: string,
    updatedBookTitle?: string,
  ) => {
    console.log("handleRevise called with:", {
      updatedStory,
      updatedTitle,
      updatedBookTitle,
    }); // ✅ LOG
    if (!currentStoryPage) return;

    setErrors({ story: "" });
    setLoading("Editing your story");
    setDisabled(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        setDisabled(false);
        setLoading(false);
        return;
      }

      // if there's a new image file selected, upload it first and attach returned url
      let heroPayload: any = {};

      if (editedHeroFile) {
        setHeroUploading(true);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(editedHeroFile);
        });

        const uploadRes = await fetch(
          `${serverBaseUrl}/user/story/${currentStoryPage._id}/hero`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              image: dataUrl,
              alignment: editedHeroAlignment,
            }),
          },
        );

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          toast.error(uploadData.message || "Failed to upload hero image");
          setHeroUploading(false);
          setDisabled(false);
          setLoading(false);
          return;
        }

        heroPayload.heroImageUrl = uploadData.response?.heroImageUrl;
        heroPayload.heroImageAlignment =
          uploadData.response?.heroImageAlignment;
        setHeroUploading(false);
      }
      const body: any = { ...heroPayload };
      if (updatedStory !== undefined) body.story = updatedStory;
      if (updatedTitle !== undefined) body.story_title = updatedTitle; // ✅ ADD
      if (updatedBookTitle !== undefined)
        (body as any).book_version_title = updatedBookTitle;
      // Always include alignment change (even if no new file uploaded)
      if (editedHeroAlignment) body.heroImageAlignment = editedHeroAlignment;
      // If there's an existing preview URL and no new file, include it so backend keeps the image
      if (editedHeroPreview && !editedHeroFile)
        body.heroImageUrl = editedHeroPreview;
      // If user removed the image (no file and no preview), explicitly clear it
      if (!editedHeroFile && !editedHeroPreview) body.heroImageUrl = null;
      console.log("Request body for reviseStory:", body); // ✅ LOG
      const res = await fetch(
        `${serverBaseUrl}/user/story/${currentStoryPage._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        if (handleSessionExpiry(data.message, router, true)) return;
        toast.error(data.message || "Failed to revise story");
        return;
      }

      await loadStoryPages(currentStoryPage?._id);
      toast.success(data.message);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to revise story");
    } finally {
      setDisabled(false);
      setLoading(false);
    }
  };

  const handleHeroFileChange = (file?: File) => {
    if (!file) return;
    const validTypes = ["image/jpg", "image/png"];
    const ext = (file.name || "").split(".").pop()?.toLowerCase();
    if (
      !validTypes.includes(file.type) &&
      !["jpg", "png"].includes(ext || "")
    ) {
      toast.error("Invalid file type. Only JPG and PNG images are allowed.");
      try {
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (e) {
        // ignore
      }
      setEditedHeroFile(null);
      setEditedHeroPreview(null);
      return;
    }

    setEditedHeroFile(file);
    const reader = new FileReader();
    reader.onload = () => setEditedHeroPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleHeroFileChange(f);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const removeHeroImage = () => {
    setEditedHeroFile(null);
    setEditedHeroPreview(null);
  };

  const loadStoryPages = async (preserveId?: string) => {
    setLoading("Retrieving something beautiful from what you've shared…");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${serverBaseUrl}/user/story`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleSessionExpiry(data.message, router, true)) return;
        toast.error(data.message || "Failed to fetch stories");
        return;
      }

      const pages = data?.response?.data || [];
      setStoryPages(pages);
      const totalPages = pages.length;

      if (preserveId) {
        const idx = pages.findIndex((p: any) => p._id === preserveId);
        setCurrentPage(idx !== -1 ? idx : totalPages > 0 ? totalPages - 1 : 0);
      } else {
        setCurrentPage(totalPages > 0 ? totalPages - 1 : 0);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch stories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const getStoryPages = async () => {
      const params = new URLSearchParams(window.location.search);
      const storyId = params.get("storyId") || undefined;
      await loadStoryPages(storyId);
    };
    getStoryPages();
  }, []);

  useEffect(() => {
    setCurrentStoryPage(storyPages[currentPage]);
  }, [currentPage, storyPages]);

  useEffect(() => {
    const initDraft = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const savedId = localStorage.getItem(DRAFT_BOOK_KEY);
        if (!savedId) return;

        setDraftBookId(savedId);

        const book = await getBook(savedId, token);
        console.log("Draft book loaded:", book);
        setDraftCount(book?.items?.length || 0);
      } catch {
        localStorage.removeItem(DRAFT_BOOK_KEY);
        setDraftBookId(null);
        setDraftCount(0);
      }
    };

    initDraft();
  }, []);

  const nextPage = () => {
    if (currentPage < storyPages.length - 1 && !isAnimating) {
      setDirection("forward");
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentPage((prev) => prev + 1);
        setTimeout(() => setIsAnimating(false), 300);
      }, 150);
    }
  };

  const previousPage = () => {
    if (currentPage > 0 && !isAnimating) {
      setDirection("backward");
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentPage((prev) => prev - 1);
        setTimeout(() => setIsAnimating(false), 300);
      }, 150);
    }
  };

  const goToPage = (index: number) => {
    if (!isAnimating && index !== currentPage) {
      setDirection(index > currentPage ? "forward" : "backward");
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentPage(index);
        setTimeout(() => setIsAnimating(false), 300);
      }, 150);
    }
  };

  const rawReadTime = currentStoryPage?.read_time ?? "0 minutes read";
  const [readTime, ...readTimeLabelParts] = rawReadTime.split(" ");
  const readTimeLabel = readTimeLabelParts.join(" ");

  const onClose = () => {
    setIsEditing(false);
    setEditedStory(currentStoryPage?.enhanced_story);
    setEditedTitle(currentStoryPage?.story_title || "");
    setEditedBookTitle(
      (currentStoryPage as any)?.book_version_title ||
        currentStoryPage?.story_title ||
        "",
    );
    setEditedHeroPreview((currentStoryPage as any)?.heroImageUrl || null);
    setEditedHeroAlignment(
      ((currentStoryPage as any)?.heroImageAlignment as any) || "center",
    );
    setEditedHeroFile(null);
  };

  const handleDelete = async (storyId: string) => {
    if (!currentStoryPage) return;
    const index = storyPages.findIndex((s) => s._id === storyId);
    if (index === -1) return;
    setLoading("Deleting your story");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${serverBaseUrl}/user/story/${storyId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleSessionExpiry(data.message, router, true)) return;
        toast.error(data.message || "Failed to delete story");
        return;
      }

      const newPages = storyPages.filter((s) => s._id !== storyId);
      setStoryPages(newPages);
      if (newPages.length === 0) {
        setCurrentPage(0);
      } else {
        const nextIndex =
          index <= newPages.length - 1 ? index : newPages.length - 1;
        setCurrentPage(nextIndex);
      }

      await loadStoryPages();
      toast.success(data.message);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete story");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCurrentStoryToBook = async () => {
    // Open modal to select existing book or create new
    setBooksLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        return;
      }
      const list = await getMyBooks(token);
      setBooks(list || []);
      setShowAddToBookModal(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load books");
    } finally {
      setBooksLoading(false);
    }
  };

  const handleViewBook = () => {
    // Open modal to view all books and navigate to one
    (async () => {
      setBooksLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Please login again");
          return;
        }
        const list = await getMyBooks(token);
        setBooks(list || []);
        setShowViewBooksModal(true);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load books");
      } finally {
        setBooksLoading(false);
      }
    })();
  };

  const handleDeleteBook = async (bookId: string | null) => {
    if (!bookId) return;
    setBooksLoading(true);
    setDeletingBookId(bookId);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        return;
      }

      const res = await fetch(`${serverBaseUrl}/user/book/${bookId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleSessionExpiry(data.message, router, true)) return;
        toast.error(data.message || "Failed to delete book");
        return;
      }

      setBooks((prev) => (prev || []).filter((b) => b._id !== bookId));
      if (draftBookId === bookId) {
        localStorage.removeItem(DRAFT_BOOK_KEY);
        setDraftBookId(null);
        setDraftCount(0);
      }

      toast.success(data.message || "Book deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete book");
    } finally {
      setBooksLoading(false);
      setBookToDeleteId(null);
      setShowDeleteConfirmModal(false);
      setDeletingBookId(null);
    }
  };
  return (
    <PrivateRoute>
      <div className="bg-white">
        {/* Hero Section */}
        <div
          className="relative w-full py-15 md:h-[50vh] bg-cover bg-center"
          style={{ backgroundImage: 'url("/assets/story-homepage.jpg")' }}
        >
          <div className="absolute inset-0 bg-black opacity-20"></div>
          <div className="relative px-4">
            <div className="max-w-6xl text-white mx-auto text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-8xl font-serif mb-6 leading-tight">
                Capturing Story Gems
              </h1>
              <p className="text-normal sm:text-lg xl:text-2xl mb-8 leading-relaxed max-w-3xl mx-auto opacity-90">
                Your memories have a heartbeat. Let&apos;s give them a voice
              </p>
            </div>
          </div>
        </div>

        {storyPages.length < 1 && (
          <div className="flex flex-col gap-4 justify-center items-center mb-8 bg-white">
            <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-serif mt-16 leading-tight">
              No Stories Found
            </h1>
            <Button
              onClick={() => router.push("upload-story")}
              className="flex gap-2 bg-[#457B9D] text-[#FAF9F6] py-2 px-8 rounded-full text-lg font-semibold hover:bg-[#375E73] transition"
            >
              <IoMdCreate className="w-4 h-4 mr-2" />
              Want to create
            </Button>
          </div>
        )}
        {storyPages.length > 0 && (
          <>
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
              <div className="max-w-6xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                  <span>
                    Story {currentPage + 1} of {storyPages.length}
                  </span>
                  <span className="hidden sm:inline">
                    {Math.round(((currentPage + 1) / storyPages.length) * 100)}%
                    Complete
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-linear-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        ((currentPage + 1) / storyPages.length) * 100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="py-8 sm:py-12 lg:py-16 px-4 bg-white">
              <div className="max-w-7xl mx-auto">
                <div className="hidden lg:flex justify-center mb-8">
                  <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-lg border border-white/20">
                    <button
                      onClick={() => {
                        if (currentStoryPage) {
                          setEditedStory(currentStoryPage.enhanced_story);
                          setEditedTitle(currentStoryPage.story_title);
                          setEditedBookTitle(
                            (currentStoryPage as any)?.book_version_title ||
                              currentStoryPage.story_title ||
                              "",
                          );
                          setEditedHeroPreview(
                            (currentStoryPage as any)?.heroImageUrl || null,
                          );
                          setEditedHeroAlignment(
                            ((currentStoryPage as any)
                              ?.heroImageAlignment as any) || "center",
                          );
                          setEditedHeroFile(null);
                          setIsEditing(true);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:shadow-lg hover:scale-105 font-medium"
                    >
                      <Edit3 className="w-4 h-4" />
                      Revise
                    </button>
                    <button
                      onClick={() => {
                        handleDownload(currentStoryPage);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 hover:shadow-lg hover:scale-105 font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => {
                        handlePrintPDF(currentStoryPage);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 hover:shadow-lg hover:scale-105 font-medium"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                    <button
                      onClick={() => {
                        handleDelete(currentStoryPage?._id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 hover:shadow-lg hover:scale-105 font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                    <button
                      onClick={handleAddCurrentStoryToBook}
                      disabled={bookLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 hover:shadow-lg hover:scale-105 font-medium disabled:opacity-50"
                    >
                      <BookPlus className="w-4 h-4" />
                      Create Storybook ({draftCount})
                    </button>
                    <button
                      onClick={handleViewBook}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-shadow shadow-sm font-medium"
                    >
                      View Book
                    </button>
                    <button
                      onClick={() => setShowViewStoriesModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-shadow shadow-sm font-medium"
                    >
                      View My Stories
                    </button>
                  </div>
                </div>
                <div className="lg:hidden relative mb-6">
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowMobileActions(!showMobileActions)}
                      className="flex items-center gap-2 px-4 py-3 bg-white/90 backdrop-blur-sm text-slate-700 rounded-full shadow-lg border border-white/20 hover:bg-white transition-all duration-300"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                      Actions
                    </button>
                  </div>

                  {showMobileActions && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-10">
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl border border-white/20 min-w-70">
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => {
                              if (currentStoryPage) {
                                setEditedStory(currentStoryPage.enhanced_story);
                                setEditedTitle(currentStoryPage.story_title);
                                setEditedBookTitle(
                                  (currentStoryPage as any)
                                    ?.book_version_title ||
                                    currentStoryPage.story_title ||
                                    "",
                                );
                                setEditedHeroPreview(
                                  (currentStoryPage as any)?.heroImageUrl ||
                                    null,
                                );
                                setEditedHeroAlignment(
                                  ((currentStoryPage as any)
                                    ?.heroImageAlignment as any) || "center",
                                );
                                setEditedHeroFile(null);
                                setIsEditing(true);
                                setShowMobileActions(false);
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 text-sm font-medium"
                          >
                            <Edit3 className="w-4 h-4" />
                            Revise
                          </button>
                          <button
                            onClick={() => {
                              handleDownload(currentStoryPage);
                              setShowMobileActions(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 bg-linear-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 text-sm font-medium"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                          <button
                            onClick={() => {
                              handlePrintPDF(currentStoryPage);
                              setShowMobileActions(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 bg-linear-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 text-sm font-medium"
                          >
                            <Printer className="w-4 h-4" />
                            Print
                          </button>
                          <button
                            onClick={() => {
                              handleDelete(currentStoryPage?._id);
                              setShowMobileActions(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 text-sm font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                          <button
                            onClick={() => {
                              handleAddCurrentStoryToBook();
                              setShowMobileActions(false);
                            }}
                            disabled={bookLoading}
                            className="flex items-center gap-2 px-3 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 text-sm font-medium disabled:opacity-50"
                          >
                            <BookPlus className="w-4 h-4" />
                            Add ({draftCount})
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileActions(false);
                              handleViewBook();
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-300 text-sm font-medium"
                          >
                            View Book
                          </button>
                          <button
                            onClick={() => {
                              setShowMobileActions(false);
                              setShowViewStoriesModal(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 text-sm font-medium"
                          >
                            View My Stories
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-0 md:px-4 gap-8 lg:gap-16 items-center">
                  <div
                    className={`transition-all duration-500 ease-in-out ${
                      isAnimating
                        ? direction === "forward"
                          ? "transform translate-x-8 opacity-0"
                          : "transform -translate-x-8 opacity-0"
                        : "transform translate-x-0 opacity-100"
                    }`}
                  >
                    <div className="mb-8">
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif mb-6 leading-tight text-slate-800">
                        {currentStoryPage?.story_title}
                      </h2>
                    </div>

                    {currentStoryPage?.heroImageUrl && (
                      <div className="mb-6">
                        <img
                          src={currentStoryPage.heroImageUrl}
                          alt={currentStoryPage.story_title}
                          className={`w-full rounded-lg border border-[#E6EEF2] object-contain bg-gray-50 ${currentStoryPage.heroImageAlignment === "left" ? "sm:float-left sm:w-1/2 sm:mr-6 sm:max-h-125" : currentStoryPage.heroImageAlignment === "right" ? "sm:float-right sm:w-1/2 sm:ml-6 sm:max-h-125" : "w-full sm:w-full sm:max-h-150"}`}
                        />
                      </div>
                    )}

                    <div className="prose prose-lg max-w-none">
                      <p className="text-base sm:text-lg leading-relaxed text-slate-700 mb-8">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: currentStoryPage?.enhanced_story
                              ?.replace(/\n\n/g, "<br /><br />")
                              ?.replace(/\n/g, "<br />"),
                          }}
                        />
                      </p>
                    </div>

                    <div className="block lg:hidden mt-8">
                      <div className="flex items-center justify-between mb-4">
                        <Button
                          onClick={previousPage}
                          disabled={currentPage === 0 || isAnimating}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>

                        <Button
                          onClick={nextPage}
                          disabled={
                            currentPage === storyPages.length - 1 || isAnimating
                          }
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex justify-center gap-2">
                        {buildPagination(storyPages.length, currentPage, 7).map(
                          (p, i) =>
                            p === "..." ? (
                              <span
                                key={`e-${i}`}
                                className="px-2 text-sm text-slate-400"
                              >
                                ...
                              </span>
                            ) : (
                              <button
                                key={p}
                                onClick={() => goToPage(Number(p) - 1)}
                                className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-all duration-300 text-xs sm:text-sm font-medium
                                ${
                                  Number(p) - 1 === currentPage
                                    ? "bg-blue-600 text-white scale-110"
                                    : "bg-slate-300 text-black hover:bg-slate-400"
                                }`}
                              >
                                {p}
                              </button>
                            ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden lg:flex items-center justify-between mt-12 max-w-4xl mx-auto">
                  <Button
                    onClick={previousPage}
                    disabled={currentPage === 0 || isAnimating}
                    variant="outline"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl disabled:opacity-50 hover:shadow-lg transition-all duration-300"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Previous Story
                  </Button>

                  <div className="flex gap-3 items-center">
                    {buildPagination(storyPages.length, currentPage, 9).map(
                      (p, i) =>
                        p === "..." ? (
                          <span
                            key={`e-${i}`}
                            className="px-2 text-sm text-slate-400"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => goToPage(Number(p) - 1)}
                            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110 text-sm font-medium
                            ${
                              Number(p) - 1 === currentPage
                                ? "bg-black text-white scale-125"
                                : "bg-slate-300 text-black hover:bg-slate-400"
                            }`}
                          >
                            {p}
                          </button>
                        ),
                    )}
                  </div>

                  <Button
                    onClick={nextPage}
                    disabled={
                      currentPage === storyPages.length - 1 || isAnimating
                    }
                    variant="outline"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl disabled:opacity-50 hover:shadow-lg transition-all duration-300"
                  >
                    Next Story
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="py-12 sm:py-16 bg-white">
              <div className="max-w-6xl mx-auto px-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                  <div className="text-center p-6 sm:p-8 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-50 hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold mb-2 text-slate-800">
                      {storyPages.length}
                    </div>
                    <div className="text-slate-600">Stories</div>
                  </div>
                  <div className="text-center p-6 sm:p-8 rounded-2xl bg-linear-to-br from-green-50 to-emerald-50 hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                      <Clock className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold mb-2 text-slate-800">
                      {readTime}
                    </div>
                    <div className="text-slate-600">{readTimeLabel}</div>
                  </div>
                  <div className="text-center p-6 sm:p-8 rounded-2xl bg-linear-to-br from-purple-50 to-violet-50 hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                      <User className="w-8 h-8 text-purple-600" />
                    </div>
                    <div className="text-3xl font-bold mb-2 text-slate-800">
                      {currentStoryPage?.genre}
                    </div>
                    <div className="text-slate-600">Genre</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer Quote */}
        <div className="py-16 sm:py-20 bg-[#457B9D] text-white relative overflow-hidden">
          <div className="relative max-w-5xl mx-auto text-center px-4">
            <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <BookOpen className="w-10 h-10" />
            </div>
            <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-serif italic mb-6 leading-relaxed">
              &quot;Your stories are worth telling… let’s
              bring them to life.&quot;
            </blockquote>
            <p className="text-lg sm:text-xl opacity-90 max-w-2xl mx-auto">
              A timeless reminder that love grows in the gardens we tend
              together
            </p>
          </div>
        </div>

        {loading && (
          <div className="fixed flex flex-col justify-center items-center bg-[#0000007c] h-full w-full top-0 left-0 backdrop-blur-md z-50">
            <Image
              src={"/loader.svg"}
              width={100}
              height={100}
              alt="Loader"
              className="object-contain animate-spin"
            />
            <p className="text-[#F1FAEE] text-2xl font-[Cormorant_Garamond]">
              {loading}
            </p>
          </div>
        )}
      </div>

      {isEditing && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-40 p-4"
          onClick={() => setIsEditing(false)}
        >
          <div className="fixed inset-0 flex items-center justify-center px-4 animate-fade-in">
            <div
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden animate-scale-in max-h-[95vh] z-50 overflow-y-auto border border-[#A8DADC]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors group"
              >
                <X className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              </button>

              <div className="relative p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-full bg-[#457B9D] shadow-lg">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-[#1D3557] mb-2 font-[Cormorant_Garamond]">
                    Update Your Story
                  </h2>
                </div>

                <div className="relative mb-6">
                  <span className="text-gray-500 text-xs"> Story title</span>
                  <input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="Story title"
                    className="w-full mb-3 p-4 text-gray-900 bg-[#F1FAEE] border border-[#A8DADC] rounded-xl placeholder-gray-400 text-sm focus:outline-none focus:border-[#457B9D] focus:ring-4 focus:ring-[#A8DADC]/50 transition-all duration-200"
                  />
                  {/* <span className="text-gray-500 text-xs">Book Version Story title</span>
                  <input
                    value={editedTitle}
                    onChange={(e) => setEditedBookTitle(e.target.value)}
                    placeholder="Book version title (optional)"
                    className="w-full mb-3 p-4 text-gray-700 bg-[#F8FAFB] border border-[#E6EEF2] rounded-xl placeholder-gray-400 text-sm focus:outline-none focus:border-[#457B9D] focus:ring-4 focus:ring-[#A8DADC]/30 transition-all duration-200"
                  /> */}
                  <span className="text-gray-500 text-xs"> Story</span>
                  <textarea
                    value={editedStory}
                    onChange={(e) => setEditedStory(e.target.value)}
                    placeholder="Once upon a time... or perhaps it was just yesterday."
                    className="w-full h-32 p-4 text-gray-800 bg-[#F1FAEE] border border-[#A8DADC] rounded-xl resize-none placeholder-gray-400 text-sm leading-relaxed focus:outline-none focus:border-[#457B9D] focus:ring-4 focus:ring-[#A8DADC]/50 transition-all duration-200"
                    rows={4}
                  />
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hero image (optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Your image will be fitted to preserve the entire content
                      without cropping. Supports JPG and PNG formats.
                    </p>
                    <div
                      className={`w-full rounded-lg border-2 ${isDragging ? "border-dashed border-blue-400 bg-blue-50" : "border-[#E6EEF2] bg-white"} p-3 flex flex-col sm:flex-row items-center gap-4`}
                      onDrop={onDrop}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpg,.png"
                        onChange={(e) =>
                          handleHeroFileChange(e.target.files?.[0])
                        }
                        className="hidden"
                      />

                      <div className="flex-1 w-full">
                        {editedHeroPreview ? (
                          <div className="w-full h-36 sm:h-40 overflow-hidden rounded-md border border-[#E6EEF2] flex items-center justify-center bg-gray-50">
                            <img
                              src={editedHeroPreview}
                              alt="preview"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-36 sm:h-40 rounded-md flex items-center justify-center text-sm text-gray-500">
                            <div className="text-center">
                              <p className="mb-1">
                                Drag & drop an image here, or
                              </p>
                              <button
                                type="button"
                                onClick={openFileDialog}
                                className="px-3 py-2 bg-[#457B9D] text-white rounded-md shadow-sm"
                              >
                                Choose image
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditedHeroAlignment("left")}
                            className={`px-3 py-2 rounded ${editedHeroAlignment === "left" ? "bg-[#457B9D] text-white" : "bg-gray-100"}`}
                          >
                            Left
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditedHeroAlignment("center")}
                            className={`px-3 py-2 rounded ${editedHeroAlignment === "center" ? "bg-[#457B9D] text-white" : "bg-gray-100"}`}
                          >
                            Center
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditedHeroAlignment("right")}
                            className={`px-3 py-2 rounded ${editedHeroAlignment === "right" ? "bg-[#457B9D] text-white" : "bg-gray-100"}`}
                          >
                            Right
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={openFileDialog}
                            className="px-3 py-2 text-sm rounded bg-white border border-[#E6EEF2]"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={removeHeroImage}
                            className="px-3 py-2 text-sm rounded bg-red-50 text-red-700 border border-red-100"
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Alignment: {editedHeroAlignment}
                        </p>
                      </div>
                    </div>
                  </div>
                  {errors?.story && (
                    <p className="joi-error-message mb-4 text-xs">
                      {errors?.story[0]}
                    </p>
                  )}
                </div>

                <div className="flex justify-between items-center mt-1 px-1 text-xs text-gray-500">
                  <span
                    className={
                      editedStory.length ? "text-[#457B9D] font-medium" : ""
                    }
                  >
                    {editedStory.length > 0 && "Great start!"}
                  </span>
                  <span>
                    {formatWordCount(countWords(editedStory))}/
                    {formatWordCount(MAX_STORY_WORDS)} words
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                  <Button
                    onClick={() =>
                      handleRevise(editedStory, editedTitle, editedBookTitle)
                    }
                    disabled={
                      editedStory.trim().length === 0 ||
                      editedTitle.trim().length === 0 ||
                      disabled
                    }
                    className="flex-1 py-3 text-sm font-semibold bg-[#457B9D] text-white hover:bg-[#1D3557] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                  >
                    Upload & Save Changes
                    <Sparkles className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                <div className="mt-6 p-3 bg-[#F1FAEE] border border-[#A8DADC] rounded-xl">
                  <p className="text-center text-[#5A9AAF] italic text-xs">
                    &quot;The universe is made of stories, not atoms.&quot; –
                    Muriel Rukeyser
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to Book Modal */}
      {showAddToBookModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-40 p-4"
          onClick={() => setShowAddToBookModal(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto border border-[#E6EEF2]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Add to Book</h3>
              <button
                onClick={() => setShowAddToBookModal(false)}
                className="p-2 rounded hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-slate-600">
                  New Storybook title
                </label>
                <input
                  className="w-full p-2 border rounded"
                  placeholder="e.g., Grandma's Memoirs"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                />
              </div>
              <Button
                disabled={creatingBook}
                onClick={async () => {
                  if (!currentStoryPage?._id) return;
                  setCreatingBook(true);
                  try {
                    const token = localStorage.getItem("token");
                    if (!token) return toast.error("Please login again");
                    const created = await createDraftBook(token, newBookTitle);
                    const newId = created._id;
                    await addStoryToBook(newId, currentStoryPage._id, token);
                    localStorage.setItem(DRAFT_BOOK_KEY, newId);
                    setDraftBookId(newId);
                    const b = await getBook(newId, token);
                    setDraftCount(b?.items?.length || 0);
                    toast.success("Story added to new book");
                    setNewBookTitle("");
                    setShowAddToBookModal(false);
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to create/add to book");
                  } finally {
                    setCreatingBook(false);
                  }
                }}
                className="w-full bg-[#457B9D] text-white"
              >
                {creatingBook ? "Creating…" : `Create/Save New Storybook Title`}
              </Button>

              <div className="text-sm text-slate-500">
                Or select an existing book
              </div>

              <div className="divide-y border rounded">
                {booksLoading && <div className="p-3 text-sm">Loading…</div>}
                {!booksLoading && books.length === 0 && (
                  <div className="p-3 text-sm">No books yet</div>
                )}
                {!booksLoading &&
                  books.map((b) => (
                    <button
                      key={b._id}
                      onClick={async () => {
                        if (!currentStoryPage?._id) return;
                        setBookLoading(true);
                        try {
                          const token = localStorage.getItem("token");
                          if (!token) return toast.error("Please login again");
                          await addStoryToBook(
                            b._id,
                            currentStoryPage._id,
                            token,
                          );
                          localStorage.setItem(DRAFT_BOOK_KEY, b._id);
                          setDraftBookId(b._id);
                          const book = await getBook(b._id, token);
                          setDraftCount(book?.items?.length || 0);
                          toast.success("Story added to selected book");
                          setShowAddToBookModal(false);
                        } catch (err: any) {
                          if (err?.status === 409) {
                            toast.info("This story is already in that book");
                          } else {
                            toast.error(
                              err?.message || "Failed to add story to book",
                            );
                          }
                        } finally {
                          setBookLoading(false);
                        }
                      }}
                      className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="font-medium">{b.title}</span>
                      <span className="text-xs text-slate-500">
                        {b.itemsCount ?? 0} stories
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Books Modal */}
      {showViewBooksModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-40 p-4"
          onClick={() => setShowViewBooksModal(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto border border-[#E6EEF2]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Your Books</h3>
              <button
                onClick={() => setShowViewBooksModal(false)}
                className="p-2 rounded hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {booksLoading && <div className="p-3 text-sm">Loading…</div>}
              {!booksLoading && books.length === 0 && (
                <div className="p-3 text-sm">No books yet</div>
              )}
              <div className="divide-y border rounded">
                {!booksLoading &&
                  books.map((b) => (
                    <div
                      key={b._id}
                      className="w-full p-3 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <button
                        onClick={() => {
                          localStorage.setItem(DRAFT_BOOK_KEY, b._id);
                          setShowViewBooksModal(false);
                          router.push(`/book-builder?bookId=${b._id}`);
                        }}
                        className="text-left flex-1"
                      >
                        <span className="font-medium">{b.title}</span>
                        <div className="text-xs text-slate-500">
                          {b.itemsCount ?? 0} stories
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBookToDeleteId(b._id);
                          setShowDeleteConfirmModal(true);
                        }}
                        disabled={deletingBookId === b._id}
                        className={`p-2 ml-3 rounded hover:bg-slate-100 text-red-600 ${deletingBookId === b._id ? "opacity-60 cursor-not-allowed" : ""}`}
                        aria-label="Delete book"
                      >
                        {deletingBookId === b._id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Stories Modal */}
      {showViewStoriesModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-40 p-4"
          onClick={() => setShowViewStoriesModal(false)}
        >
          <div
            style={{ scrollbarWidth: "none" }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto border border-[#E6EEF2]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Your Stories</h3>
              <button
                onClick={() => setShowViewStoriesModal(false)}
                className="p-2 rounded hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {loading && <div className="p-3 text-sm">Loading…</div>}
              {!loading && (!storyPages || storyPages.length === 0) && (
                <div className="p-3 text-sm">No stories yet</div>
              )}
              <div className="divide-y border rounded">
                {!loading &&
                  storyPages.map((s, idx) => (
                    <button
                      key={s._id}
                      onClick={() => {
                        setCurrentPage(idx);
                        setShowViewStoriesModal(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {s.story_title || "Untitled"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.read_time || ""} • {s.genre || ""}
                        </div>
                      </div>
                      <span className="ml-4 inline-flex items-center px-3 py-1 rounded-full bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors">
                        Go
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          onClick={() => {
            setShowDeleteConfirmModal(false);
            setBookToDeleteId(null);
          }}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden max-h-[80vh] overflow-y-auto border border-[#E6EEF2]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Delete Book</h3>
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setBookToDeleteId(null);
                }}
                className="p-2 rounded hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <p className="mb-4 text-slate-700">
                Are you sure you want to delete this book? This action cannot be
                undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setBookToDeleteId(null);
                  }}
                  className="px-4 py-2 rounded border"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteBook(bookToDeleteId)}
                  disabled={deletingBookId === bookToDeleteId}
                  className={`px-4 py-2 rounded bg-red-600 text-white ${deletingBookId === bookToDeleteId ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {deletingBookId === bookToDeleteId ? (
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deleting…</span>
                    </div>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PrivateRoute>
  );
};

export default Story;
