import { useQuery } from "@tanstack/react-query";
import { api } from "./utils";

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Contract {
  id: string;
  fileUrl: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  status: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface KysProfile {
  id: string;
  track: "pre_seed" | "seed";
  incorporated: boolean;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
  incorporationDate: string | null;
  tin: string | null;
  signatoryName: string | null;
  signatoryPhone: string | null;
  signatoryEmail: string | null;
  irsForm: "w9" | "w8ben" | "w8bene" | null;
  acceptsAltPayment: boolean | null;
  altPaymentDetail: string | null;
  repName: string | null;
  repPhone: string | null;
  repEmail: string | null;
  disclaimerAccepted: boolean | null;
  consentAccepted: boolean;
  submittedAt: string;
  status: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface KysDocument {
  id: string;
  docType:
    | "certificate_of_incorporation"
    | "proof_of_address"
    | "irs_form"
    | "banking"
    | "declaration"
    | "identity_document";
  fileUrl: string;
  fileName: string;
}

/** Real Contract & KYS status - drives the priority-lane lock/unlock everywhere. */
export function useKysStatus() {
  const contractQuery = useQuery<{ contract: Contract | null }>({
    queryKey: ["contract"],
    queryFn: () => api("/api/contract"),
  });
  const kysQuery = useQuery<{ profile: KysProfile | null; documents: KysDocument[] }>({
    queryKey: ["kys"],
    queryFn: () => api("/api/kys"),
  });

  const contract = contractQuery.data?.contract ?? null;
  const kysProfile = kysQuery.data?.profile ?? null;

  return {
    contract,
    kysProfile,
    kysDocuments: kysQuery.data?.documents ?? [],
    contractSigned: !!contract,
    kysSubmitted: !!kysProfile,
    contractRejected: contract?.status === "rejected",
    kysRejected: kysProfile?.status === "rejected",
    isLoading: contractQuery.isLoading || kysQuery.isLoading,
  };
}
