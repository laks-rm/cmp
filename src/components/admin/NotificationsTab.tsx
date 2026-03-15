"use client";

import { useState } from "react";
import { Bell, Mail, MessageSquare, CheckCircle, XCircle, Save } from "lucide-react";
import toast from "@/lib/toast";

type EventType = {
  id: string;
  name: string;
  description: string;
  recipients: string;
  inApp: boolean;
  email: boolean;
  slack: boolean;
};

const NOTIFICATION_EVENTS: EventType[] = [
  {
    id: "task_submitted",
    name: "Task Submitted for Review",
    description: "When a task is submitted for approval",
    recipients: "Reviewer, PIC",
    inApp: true,
    email: true,
    slack: false,
  },
  {
    id: "task_approved",
    name: "Task Approved",
    description: "When a task is approved by reviewer",
    recipients: "Responsible, PIC",
    inApp: true,
    email: false,
    slack: false,
  },
  {
    id: "task_rejected",
    name: "Task Rejected",
    description: "When changes are requested on a task",
    recipients: "Responsible",
    inApp: true,
    email: true,
    slack: false,
  },
  {
    id: "task_overdue",
    name: "Task Overdue",
    description: "When a task passes its due date",
    recipients: "Responsible, PIC, Manager",
    inApp: true,
    email: true,
    slack: true,
  },
  {
    id: "finding_created",
    name: "Finding Created",
    description: "When a new finding is raised",
    recipients: "Action Owner, Manager",
    inApp: true,
    email: true,
    slack: false,
  },
  {
    id: "finding_overdue",
    name: "Finding Overdue",
    description: "When a finding passes its target date",
    recipients: "Action Owner, Manager",
    inApp: true,
    email: true,
    slack: true,
  },
  {
    id: "task_assigned",
    name: "New Task Assigned",
    description: "When a task is assigned to a user",
    recipients: "Responsible",
    inApp: true,
    email: true,
    slack: false,
  },
  {
    id: "source_generated",
    name: "Source Generated",
    description: "When a source is generated with tasks",
    recipients: "Team Members",
    inApp: true,
    email: false,
    slack: false,
  },
];

export function NotificationsTab() {
  const [events, setEvents] = useState<EventType[]>(NOTIFICATION_EVENTS);
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (eventId: string, channel: "inApp" | "email" | "slack") => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId ? { ...event, [channel]: !event[channel] } : event
      )
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    // In a real implementation, this would call an API to save the notification settings
    toast.success("Notification settings saved");
    setHasChanges(false);
  };

  const handleReset = () => {
    setEvents(NOTIFICATION_EVENTS);
    setHasChanges(false);
    toast("Settings reset to default");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Notification Channels
        </h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Configure which channels receive notifications for each event type
        </p>
      </div>

      {/* Notifications Table */}
      <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Event Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Recipients
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  <div className="flex items-center justify-center gap-2">
                    <Bell size={14} />
                    <span>In-App</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  <div className="flex items-center justify-center gap-2">
                    <Mail size={14} />
                    <span>Email</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  <div className="flex items-center justify-center gap-2">
                    <MessageSquare size={14} />
                    <span>Slack</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ borderBottom: "1px solid var(--border-light)" }}
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {event.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {event.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {event.recipients}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(event.id, "inApp")}
                      className="rounded-full p-1 transition-colors"
                      style={{
                        backgroundColor: event.inApp ? "var(--green-light)" : "var(--bg-subtle)",
                      }}
                    >
                      {event.inApp ? (
                        <CheckCircle size={18} style={{ color: "var(--green)" }} />
                      ) : (
                        <XCircle size={18} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(event.id, "email")}
                      className="rounded-full p-1 transition-colors"
                      style={{
                        backgroundColor: event.email ? "var(--green-light)" : "var(--bg-subtle)",
                      }}
                    >
                      {event.email ? (
                        <CheckCircle size={18} style={{ color: "var(--green)" }} />
                      ) : (
                        <XCircle size={18} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(event.id, "slack")}
                      className="rounded-full p-1 transition-colors"
                      style={{
                        backgroundColor: event.slack ? "var(--green-light)" : "var(--bg-subtle)",
                      }}
                    >
                      {event.slack ? (
                        <CheckCircle size={18} style={{ color: "var(--green)" }} />
                      ) : (
                        <XCircle size={18} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save/Reset Buttons */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-3 rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <p className="mr-auto text-sm" style={{ color: "var(--text-secondary)" }}>
            You have unsaved changes
          </p>
          <button
            onClick={handleReset}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: "var(--blue)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
