import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePackageRouteData } from "@/hooks/usePackageRouteData";
import { toast } from "@/hooks/use-toast";
import { persistPackageReview } from "@/lib/registry-api";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";

const REVIEW_RATINGS = ["5.0", "4.5", "4.0", "3.5", "3.0", "2.5", "2.0", "1.5", "1.0"] as const;

function formatReviewAuthor(author: string, walletAddress?: string) {
  const value = walletAddress ?? author;
  if (!value.startsWith("0x")) {
    return author;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function PackageReviews() {
  const queryClient = useQueryClient();
  const { pkg } = usePackageRouteData();
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<string>("5.0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    address,
    availableWallets,
    connect,
    ensurePrimeGateSession,
    isConnected,
  } = usePrimeGateWallet();

  const myReview = useMemo(() => {
    if (!address) {
      return null;
    }

    return (
      pkg.reviews.find((review) => review.walletAddress?.toLowerCase() === address.toLowerCase()) ?? null
    );
  }, [address, pkg.reviews]);

  useEffect(() => {
    if (!myReview) {
      setBody("");
      setRating("5.0");
      return;
    }

    setBody(myReview.body);
    setRating(myReview.rating);
  }, [myReview]);

  const handleSubmit = async () => {
    try {
      if (!isConnected) {
        if (availableWallets.length > 0) {
          await connect(availableWallets[0].name);
          return;
        }

        throw new Error("Connect your wallet before leaving a review.");
      }

      if (!body.trim()) {
        toast({
          title: "Review message required",
          description: "Write a short review before submitting.",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);
      await ensurePrimeGateSession();
      await persistPackageReview({
        body: body.trim(),
        packageId: pkg.id,
        rating,
      });

      await queryClient.invalidateQueries({
        queryKey: ["primegate", "package", pkg.id],
      });

      toast({
        title: myReview ? "Review updated" : "Review added",
        description: `Your review for ${pkg.name} is now live on PrimeGate.`,
      });
    } catch (error) {
      toast({
        title: "Review failed",
        description: error instanceof Error ? error.message : "PrimeGate could not save your review.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-4 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Leave a Review</h2>
          <p className="text-xs text-muted-foreground">
            Reviews are tied to the connected wallet. Submitting again updates your existing review for this package.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="package-review-rating">Rating</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger id="package-review-rating">
                <SelectValue placeholder="Choose a rating" />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_RATINGS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value} / 5
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="package-review-body">Message</Label>
            <Textarea
              id="package-review-body"
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What was useful, what was missing, and how this package worked for you."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? "Saving Review..." : myReview ? "Update Review" : "Publish Review"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {isConnected ? "Signed in wallet reviews are public on PrimeGate." : "Connect a wallet to review publicly."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {pkg.reviews.length > 0 ? (
          pkg.reviews.map((review, index) => (
            <div
              key={`${review.walletAddress ?? review.author}:${review.createdAt ?? index}`}
              className="rounded-md border p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {formatReviewAuthor(review.author, review.walletAddress)}
                  </p>
                  {review.createdAt && (
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(review.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{review.rating}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{review.body}</p>
            </div>
          ))
        ) : (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            No reviews yet. Be the first wallet to leave one.
          </div>
        )}
      </div>
    </div>
  );
}
