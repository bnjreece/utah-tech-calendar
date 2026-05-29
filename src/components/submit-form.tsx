"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Status = "idle" | "submitting" | "success" | "error";

export function SubmitForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const fd = new FormData(form);
    const tagsRaw = (fd.get("tags") as string | null) ?? "";

    const payload = {
      title: fd.get("title"),
      description: fd.get("description") || undefined,
      link: fd.get("link"),
      startsAt: fd.get("startsAt"),
      endsAt: fd.get("endsAt") || undefined,
      isOnline: fd.get("isOnline") === "on",
      venueName: fd.get("venueName") || undefined,
      address: fd.get("address") || undefined,
      city: fd.get("city") || undefined,
      state: fd.get("state") || "UT",
      postalCode: fd.get("postalCode") || undefined,
      tags: tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      submitterName: fd.get("submitterName") || undefined,
      submitterEmail: fd.get("submitterEmail") || undefined,
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus("error");
        setMessage(json.error ?? "Submission failed");
        return;
      }
      setStatus("success");
      setMessage("Thanks! We'll review and publish if it fits.");
      form.reset();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Network error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-base font-medium">{message}</p>
        <Button variant="link" onClick={() => setStatus("idle")} className="mt-2">
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Event title" name="title" required />
      <Field label="Link (more info or RSVP)" name="link" type="url" required />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Starts at" name="startsAt" type="datetime-local" required />
        <Field label="Ends at (optional)" name="endsAt" type="datetime-local" />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="isOnline" name="isOnline" />
        <Label htmlFor="isOnline" className="text-sm">
          This event is online
        </Label>
      </div>
      <Field label="Venue name" name="venueName" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Address" name="address" />
        <Field label="City" name="city" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="State" name="state" defaultValue="UT" />
        <Field label="Postal code" name="postalCode" />
      </div>
      <Field label="Description (optional)" name="description" textarea />
      <Field label="Tags (comma-separated, e.g. javascript, ai, founders)" name="tags" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Your name (optional)" name="submitterName" />
        <Field label="Your email (optional)" name="submitterEmail" type="email" />
      </div>

      {status === "error" && (
        <p className="text-sm text-destructive">{message}</p>
      )}

      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Submitting..." : "Submit for review"}
      </Button>
    </form>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  textarea?: boolean;
}

function Field({ label, name, type = "text", required, defaultValue, textarea }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-sm">
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          rows={4}
          defaultValue={defaultValue}
          required={required}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:outline-none"
        />
      ) : (
        <Input
          id={name}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
        />
      )}
    </div>
  );
}
