# Component Scalability & Architecture Guide

## Overview

This guide provides patterns for building scalable, maintainable React components in the Skill Swapping Platform.

## 1. Component Composition Patterns

### 1.1 Container vs Presentational Components

```jsx
// Container Component (handles logic, state, API calls)
export default function DashboardContainer() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  return <DashboardPresentation data={data} />;
}

// Presentational Component (receives props, renders UI)
function DashboardPresentation({ data }) {
  return <div>{/* Render data */}</div>;
}
```

### 1.2 Custom Hooks for Logic Reuse

```jsx
// Extract complex logic into custom hooks
function useMentorSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query) => {
    setLoading(true);
    try {
      const data = await client.get(`/api/search?q=${query}`);
      setResults(data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search };
}

// Use in multiple components
function MentorSearch() {
  const { results, loading, search } = useMentorSearch();
  return <SearchUI results={results} loading={loading} onSearch={search} />;
}
```

## 2. Performance Optimization Patterns

### 2.1 Memoization with React.memo

```jsx
// Memoize components that receive expensive props
const MentorCard = React.memo(
  ({ mentor, onBook }) => {
    return <div className="mentor-card">{/* Render mentor */}</div>;
  },
  (prevProps, nextProps) => {
    // Custom comparison: return true if equal (no re-render)
    return (
      prevProps.mentor.id === nextProps.mentor.id &&
      prevProps.onBook === nextProps.onBook
    );
  },
);
```

### 2.2 useMemo for Expensive Computations

```jsx
const Dashboard = ({ mentors, filters }) => {
  // Memoize filtered results
  const filteredMentors = useMemo(() => {
    return mentors.filter(
      (mentor) =>
        mentor.rating >= filters.minRating &&
        mentor.skills.includes(filters.skill),
    );
  }, [mentors, filters]);

  return <MentorGrid mentors={filteredMentors} />;
};
```

### 2.3 useCallback for Stable Function References

```jsx
const MentorList = ({ onMentorSelect }) => {
  // Prevent re-rendering of child components
  const handleSelect = useCallback(
    (mentorId) => {
      onMentorSelect(mentorId);
    },
    [onMentorSelect],
  );

  return <MentorGrid onSelect={handleSelect} />;
};
```

## 3. State Management Scalability

### 3.1 Context API for Global State

```jsx
// Create contexts for different domains
const DashboardContext = createContext();
const UserContext = createContext();
const ThemeContext = createContext();

// Provider component
export function AppProviders({ children }) {
  const [theme, setTheme] = useState("light");
  const [user, setUser] = useState(null);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <UserContext.Provider value={{ user, setUser }}>
        {children}
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}
```

### 3.2 Reducer Pattern for Complex State

```jsx
const initialState = {
  mentors: [],
  loading: false,
  error: null,
  filters: {},
};

function mentorReducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, mentors: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "SET_FILTER":
      return { ...state, filters: action.payload };
    default:
      return state;
  }
}

function MentorDashboard() {
  const [state, dispatch] = useReducer(mentorReducer, initialState);

  // Use dispatch to update state
}
```

## 4. Code Splitting & Lazy Loading

### 4.1 Route-Based Code Splitting

```jsx
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MentorProfile = lazy(() => import("./pages/MentorProfile"));

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<LazyLoadingFallback />}>
            <Dashboard />
          </Suspense>
        }
      />
    </Routes>
  );
}
```

### 4.2 Component-Based Code Splitting

```jsx
const AdvancedFilters = lazy(() => import("./components/AdvancedFilters"));

function Dashboard() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div>
      <button onClick={() => setShowAdvanced(true)}>Advanced</button>
      {showAdvanced && (
        <Suspense fallback={<div>Loading...</div>}>
          <AdvancedFilters />
        </Suspense>
      )}
    </div>
  );
}
```

## 5. Component Naming & Organization

### 5.1 Directory Structure

```
src/
├── components/
│   ├── common/
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   └── Modal.jsx
│   ├── dashboard/
│   │   ├── DashboardCard.jsx
│   │   ├── EmptyStateCard.jsx
│   │   └── DashboardSection.jsx
│   └── mentor/
│       ├── MentorCard.jsx
│       ├── MentorList.jsx
│       └── MentorFilter.jsx
├── hooks/
│   ├── useMentorSearch.js
│   ├── useBookingRetry.js
│   └── useAuth.js
├── pages/
│   ├── Dashboard.jsx
│   ├── MentorProfile.jsx
│   └── NotFound.jsx
└── utils/
    ├── performanceUtils.js
    ├── apiErrors.js
    └── i18n.js
```

### 5.2 Naming Conventions

```jsx
// Components
MentorCard; // PascalCase for components
useDataFetch; // camelCase with 'use' prefix for hooks
fetchMentors; // camelCase for functions
MENTOR_STATUS; // UPPER_SNAKE_CASE for constants
mentorData; // camelCase for variables

// Props
onMentorSelect; // camelCase with 'on' prefix for callbacks
isLoading; // camelCase with 'is/has' prefix for booleans
mentorCount; // descriptive names
```

## 6. Error Handling & Resilience

### 6.1 Error Boundaries

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### 6.2 Graceful API Error Handling

```jsx
async function fetchMentors() {
  try {
    const response = await client.get("/api/mentors");
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error("Mentors not found");
    }
    if (error.response?.status === 500) {
      throw new Error("Server error. Please try again later.");
    }
    throw error;
  }
}
```

## 7. Testing Patterns

### 7.1 Component Testing

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import MentorCard from "./MentorCard";

describe("MentorCard", () => {
  it("renders mentor information", () => {
    const mentor = { id: 1, name: "John", rating: 4.5 };
    render(<MentorCard mentor={mentor} />);
    expect(screen.getByText("John")).toBeInTheDocument();
  });

  it("calls onBook when button is clicked", () => {
    const onBook = jest.fn();
    const mentor = { id: 1, name: "John" };
    render(<MentorCard mentor={mentor} onBook={onBook} />);
    fireEvent.click(screen.getByText(/Book/i));
    expect(onBook).toHaveBeenCalledWith(1);
  });
});
```

## 8. Accessibility Patterns

### 8.1 Semantic HTML

```jsx
export function MentorList({ mentors }) {
  return (
    <section aria-label="Mentor list">
      <h2>Available Mentors</h2>
      <ul>
        {mentors.map((mentor) => (
          <li key={mentor.id}>
            <article className="mentor-card" role="article">
              <h3>{mentor.name}</h3>
              <button aria-label={`Book ${mentor.name}`}>Book</button>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### 8.2 ARIA Labels & Live Regions

```jsx
export function SearchResults({ results, isLoading }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={isLoading}
      aria-label="Search results"
    >
      {isLoading && <p>Loading results...</p>}
      {results.length === 0 && <p>No results found</p>}
      {results.map((result) => (
        <div key={result.id}>{result.title}</div>
      ))}
    </div>
  );
}
```

## 9. Bundle Size Optimization

### 9.1 Tree Shaking

```jsx
// ✅ Good: Named exports for tree shaking
export function utilA() {}
export function utilB() {}

// ❌ Avoid: Default export with multiple utilities
export default { utilA, utilB };

// ✅ Good: Import only what you need
import { utilA } from "./utils";
```

### 9.2 Dynamic Imports for Large Libraries

```jsx
async function generatePDF() {
  // Import only when needed
  const jsPDF = (await import("jspdf")).default;
  const doc = new jsPDF();
  return doc;
}
```

## 10. Production Deployment Checklist

- [ ] Remove console.logs in production
- [ ] Enable CSS code splitting
- [ ] Optimize image assets
- [ ] Set up proper error tracking (Sentry)
- [ ] Configure CDN for static assets
- [ ] Enable HTTP/2 push
- [ ] Implement service workers for offline support
- [ ] Set up proper caching headers
- [ ] Monitor Core Web Vitals
- [ ] Regular dependency updates and security audits
