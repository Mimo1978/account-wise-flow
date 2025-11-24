import { Contact } from "@/lib/types";

interface ContactNodeProps {
  contact: Contact;
  x: number;
  y: number;
}

export const ContactNode = ({ contact, x, y }: ContactNodeProps) => {
  const statusColors: Record<string, string> = {
    champion: "bg-node-champion shadow-glow",
    engaged: "bg-node-engaged",
    warm: "bg-node-warm",
    new: "bg-node-new",
    blocker: "bg-node-blocker",
    unknown: "bg-node-unknown",
  };

  const colorClass = statusColors[contact.status] || statusColors.unknown;

  return (
    <div
      className="absolute"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className={`
          w-24 h-24 rounded-full ${colorClass}
          flex flex-col items-center justify-center
          cursor-pointer transition-all duration-base
          hover:scale-110 hover:shadow-lg
          ${contact.status === "champion" ? "ring-4 ring-success/30" : ""}
        `}
      >
        <p className="text-xs font-semibold text-white text-center px-2 truncate w-full">
          {contact.name}
        </p>
        <p className="text-[10px] text-white/90 text-center px-2 truncate w-full">
          {contact.title}
        </p>
      </div>
    </div>
  );
};
