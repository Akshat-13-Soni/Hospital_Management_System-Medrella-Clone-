"use client";
import { useActionState } from "react";
import { updateProfile } from "@/actions/doctor";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  specialization: string; experienceYears: number; fee: number;
  bio: string | null; clinicAddress: string | null;
};

export function ProfileForm(d: Props) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const fe = state?.fieldErrors;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="specialization">Specialization</Label>
        <Input id="specialization" name="specialization" defaultValue={d.specialization} required />
        <FieldError messages={fe?.specialization} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="experienceYears">Experience (years)</Label>
          <Input id="experienceYears" name="experienceYears" type="number" min={0} defaultValue={d.experienceYears} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fee">Fee (₹)</Label>
          <Input id="fee" name="fee" type="number" min={0} defaultValue={d.fee} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="clinicAddress">Clinic address</Label>
        <Input id="clinicAddress" name="clinicAddress" defaultValue={d.clinicAddress ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" defaultValue={d.bio ?? ""} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save profile"}</Button>
        {state?.success && <span className="text-sm text-emerald-600">Profile saved</span>}
      </div>
    </form>
  );
}