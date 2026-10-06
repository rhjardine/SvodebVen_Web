import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import AvisoLegal from "./pages/AvisoLegal";
import Access from "./pages/Access";
import Home from "./pages/Home";
import MyListing from "./pages/MyListing";
import Secretaria from "./pages/Secretaria";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";

/** Mantener sincronizado con `shared/routes.ts` (el servidor responde 404 real al resto). */
export default function App() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/acceso" component={Access} />
        <Route path="/secretaria" component={Secretaria} />
        <Route path="/mi-ficha" component={MyListing} />
        <Route path="/aviso-legal" component={AvisoLegal} />
        <Route path="/privacidad" component={Privacy} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}
