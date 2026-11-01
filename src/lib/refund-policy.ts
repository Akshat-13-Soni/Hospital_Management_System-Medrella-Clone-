export type CancelledBy = "patient" | "doctor";

//we can edit this table to change the policy
export const REFUND_TIERS = [
    { minHours: 24, percent:100, label: "more than 24 hours before the appointment"},
    { minHours: 4, percent:50, label: "between 4 to 24 hours before the appointment"},
    { minHours: 0, percent: 0, label: "Less than 4 hours before the appointment"}
] as const;

//clinic time in IST
export function hoursUntil(date: string, startTime: string, now=new Date()){
    const start = new Date(`${date}T${startTime}:00+05:30`);
    return (start.getTime() - now.getTime())/3_600_000;
}

export function refundFor(input: {
    date: string;
    startTime: string;
    cancelledBy: CancelledBy;
    amountPaise: number;
}){
    if(input.cancelledBy === "doctor"){
        return { percent: 100, amountPaise: input.amountPaise, reason: "Cancelled by the doctor "};
    }
    const h = hoursUntil(input.date, input.startTime);
    const tier = REFUND_TIERS.find((t) => h >= t.minHours) ?? REFUND_TIERS[REFUND_TIERS.length - 1];
    return {
        percent: tier.percent,
        amountPaise: Math.floor(input.amountPaise * tier.percent / 100),
        reason: `Cancelled by the patient ${tier.label}`
    };
}

