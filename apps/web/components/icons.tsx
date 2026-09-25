import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

function Icon({ children, ...props }: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.9}
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </Icon>
  );
}

export function FlaskIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 3h6" />
      <path d="M10 3v6.2L4.9 18.2A1.9 1.9 0 0 0 6.6 21h10.8a1.9 1.9 0 0 0 1.7-2.8L14 9.2V3" />
      <path d="M7.2 15h9.6" />
    </Icon>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4.8A1.8 1.8 0 0 1 6.8 3H19v14H6.8A1.8 1.8 0 0 0 5 18.8z" />
      <path d="M5 18.8A1.8 1.8 0 0 0 6.8 20.6H19" />
      <path d="M9 7.5h6" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16" />
      <path d="M7 16.5v-5" />
      <path d="M12 16.5V7" />
      <path d="M17 16.5v-8" />
    </Icon>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6" />
      <path d="M12 16.8h.01" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 5 6v5.5c0 4.3 3 7.7 7 9 4-1.3 7-4.7 7-9V6z" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function CloudCheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 18.5h9.8a3.6 3.6 0 0 0 .3-7.2A5.6 5.6 0 0 0 6.9 10a4.3 4.3 0 0 0 .6 8.5z" />
      <path d="M9.6 14.2l1.9 1.9 3.4-3.6" />
    </Icon>
  );
}

export function CloudOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 3.5l17 17" />
      <path d="M8.3 7.4A5.6 5.6 0 0 1 17.6 11.3a3.6 3.6 0 0 1 1.9 6.1" />
      <path d="M16 18.5H7.5a4.3 4.3 0 0 1-1.3-8.4" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 3 19.5h18z" />
      <path d="M12 10v4.2" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="M9.5 6l6 6-6 6" />
    </Icon>
  );
}
