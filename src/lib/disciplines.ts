export type DisciplineId = "circuit" | "drift" | "drag" | "autocross" | "rally" | "oval";

export type SetupField = {
  key: string;
  label: string;
  unit?: string;
  type?: "text" | "number";
};

export type SetupSection = {
  title: string;
  fields: SetupField[];
};

export type Discipline = {
  id: DisciplineId;
  label: string;
  tagline: string;
  sections: SetupSection[];
};

const tires = (extra: SetupField[] = []): SetupSection => ({
  title: "Tires & Pressures",
  fields: [
    { key: "tire_compound", label: "Compound" },
    { key: "psi_lf", label: "PSI LF", unit: "psi", type: "number" },
    { key: "psi_rf", label: "PSI RF", unit: "psi", type: "number" },
    { key: "psi_lr", label: "PSI LR", unit: "psi", type: "number" },
    { key: "psi_rr", label: "PSI RR", unit: "psi", type: "number" },
    ...extra,
  ],
});

const alignment: SetupSection = {
  title: "Alignment",
  fields: [
    { key: "camber_lf", label: "Camber LF", unit: "°", type: "number" },
    { key: "camber_rf", label: "Camber RF", unit: "°", type: "number" },
    { key: "camber_lr", label: "Camber LR", unit: "°", type: "number" },
    { key: "camber_rr", label: "Camber RR", unit: "°", type: "number" },
    { key: "toe_front", label: "Toe Front", unit: "°", type: "number" },
    { key: "toe_rear", label: "Toe Rear", unit: "°", type: "number" },
    { key: "caster", label: "Caster", unit: "°", type: "number" },
  ],
};

const suspension: SetupSection = {
  title: "Suspension",
  fields: [
    { key: "spring_front", label: "Spring Front", unit: "N/mm", type: "number" },
    { key: "spring_rear", label: "Spring Rear", unit: "N/mm", type: "number" },
    { key: "ride_front", label: "Ride Height F", unit: "mm", type: "number" },
    { key: "ride_rear", label: "Ride Height R", unit: "mm", type: "number" },
    { key: "arb_front", label: "ARB Front" },
    { key: "arb_rear", label: "ARB Rear" },
    { key: "comp_front", label: "Damp. Comp F", type: "number" },
    { key: "comp_rear", label: "Damp. Comp R", type: "number" },
    { key: "reb_front", label: "Damp. Reb F", type: "number" },
    { key: "reb_rear", label: "Damp. Reb R", type: "number" },
  ],
};

const aero: SetupSection = {
  title: "Aero & Brakes",
  fields: [
    { key: "wing_front", label: "Front Wing", type: "number" },
    { key: "wing_rear", label: "Rear Wing", type: "number" },
    { key: "brake_bias", label: "Brake Bias %F", unit: "%", type: "number" },
    { key: "brake_pressure", label: "Brake Pressure", type: "number" },
  ],
};

export const DISCIPLINES: Discipline[] = [
  {
    id: "circuit",
    label: "Circuit",
    tagline: "Road racing, GT, time attack",
    sections: [tires(), alignment, suspension, aero, {
      title: "Drivetrain",
      fields: [
        { key: "diff_preload", label: "Diff Preload", type: "number" },
        { key: "diff_power", label: "Diff Power %", unit: "%", type: "number" },
        { key: "diff_coast", label: "Diff Coast %", unit: "%", type: "number" },
        { key: "final_drive", label: "Final Drive" },
      ],
    }],
  },
  {
    id: "drift",
    label: "Drift",
    tagline: "Angle, lock, smoke",
    sections: [
      tires(),
      {
        title: "Steering & Lock",
        fields: [
          { key: "steer_angle", label: "Max Steer Angle", unit: "°", type: "number" },
          { key: "ackermann", label: "Ackermann" },
          { key: "knuckles", label: "Knuckles" },
        ],
      },
      alignment,
      suspension,
      {
        title: "Drivetrain",
        fields: [
          { key: "diff_type", label: "Diff Type" },
          { key: "handbrake", label: "Handbrake" },
          { key: "clutch", label: "Clutch" },
        ],
      },
    ],
  },
  {
    id: "drag",
    label: "Drag",
    tagline: "Launch, traction, ET",
    sections: [
      tires([
        { key: "tire_size_rear", label: "Rear Tire Size" },
      ]),
      {
        title: "Launch",
        fields: [
          { key: "launch_rpm", label: "Launch RPM", unit: "rpm", type: "number" },
          { key: "boost_launch", label: "Launch Boost", unit: "psi", type: "number" },
          { key: "trans_brake", label: "Trans Brake" },
          { key: "two_step", label: "Two Step", unit: "rpm", type: "number" },
        ],
      },
      {
        title: "Suspension (Anti-squat)",
        fields: [
          { key: "rear_shock", label: "Rear Shock Setting" },
          { key: "front_shock", label: "Front Shock Setting" },
          { key: "wheelie_bar", label: "Wheelie Bar Height", unit: "in", type: "number" },
          { key: "preload", label: "Preload" },
        ],
      },
      {
        title: "Engine",
        fields: [
          { key: "boost_peak", label: "Peak Boost", unit: "psi", type: "number" },
          { key: "timing", label: "Timing", unit: "°", type: "number" },
          { key: "fuel", label: "Fuel" },
          { key: "nitrous", label: "Nitrous Stage" },
        ],
      },
    ],
  },
  {
    id: "autocross",
    label: "Autocross",
    tagline: "Tight, technical, cones",
    sections: [tires(), alignment, suspension, aero],
  },
  {
    id: "rally",
    label: "Rally",
    tagline: "Loose surface, stages",
    sections: [
      tires([{ key: "stud_pattern", label: "Stud / Pattern" }]),
      alignment,
      suspension,
      {
        title: "Drivetrain & Diffs",
        fields: [
          { key: "center_diff", label: "Center Diff" },
          { key: "front_diff", label: "Front Diff" },
          { key: "rear_diff", label: "Rear Diff" },
          { key: "handbrake", label: "Handbrake" },
        ],
      },
    ],
  },
  {
    id: "oval",
    label: "Oval",
    tagline: "Stagger, wedge, left-turn",
    sections: [
      tires(),
      {
        title: "Stagger & Weight",
        fields: [
          { key: "stagger", label: "Stagger", unit: "in", type: "number" },
          { key: "wedge", label: "Wedge", unit: "%", type: "number" },
          { key: "cross_weight", label: "Cross Weight", unit: "%", type: "number" },
          { key: "left_weight", label: "Left Side", unit: "%", type: "number" },
        ],
      },
      alignment,
      suspension,
    ],
  },
];

export function getDiscipline(id: string): Discipline {
  return DISCIPLINES.find((d) => d.id === id) ?? DISCIPLINES[0];
}