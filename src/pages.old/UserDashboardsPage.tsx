import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, Button, Spinner, Modal, Form } from "react-bootstrap";
import { useParams } from "react-router-dom";
import TopBarLogin from "../components/TopBarLogin";
import TopBarNoLogin from "../components/TopBarNoLogin";
import FooterBar from "../components/FooterBar";
import { getLocalStorage } from "../utils/localStorage";
import "../styles/UserDashboardsPage.css";

interface Dashboard {
  id: number | string;
  title: string;
  description: string;
}

const DashboardsPage = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardOwnerName, setDashboardOwnerName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const { userId: routeUserId } = useParams<{ userId: string }>();

  const loggedInUserId = getLocalStorage("user_id");
  const isLoggedIn = !!loggedInUserId;
  
  // Check if the logged-in user is viewing their own dashboards
  const isOwnDashboards = isLoggedIn && loggedInUserId === routeUserId;

  useEffect(() => {
    const fetchDashboards = async () => {
      if (!routeUserId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user info to get the owner's name
        try {
          const userResponse = await fetch(`http://localhost:8000/api/users/${routeUserId}`);
          if (userResponse.ok) {
            const contentType = userResponse.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const userData = await userResponse.json();
              setDashboardOwnerName(userData.full_name || userData.email || "Usuario");
            }
          }
        } catch (userError) {
          console.error("Error fetching user info:", userError);
          // If fetching user fails, use a fallback name
          setDashboardOwnerName("Usuario");
        }

        // Fetch dashboards
        const response = await fetch(`http://localhost:8000/api/users/${routeUserId}/dashboards`);
        if (!response.ok) throw new Error("Error al cargar los dashboards");
        const data = await response.json();

        // Set dashboards directly from API (empty array if no boards)
        setDashboards(data);
      } catch (error) {
        console.error("Error:", error);
        // Set a default name for error cases
        setDashboardOwnerName("Usuario");
        // Set empty array on error
        setDashboards([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeUserId]);

  const handleCreateBoard = async () => {
    if (!newBoardTitle.trim()) {
      alert("Por favor ingresa un nombre para el tablero");
      return;
    }

    setCreating(true);
    try {
      // TODO: Replace with actual API call to create dashboard
      // For now, just simulate creation
      console.log("Creating board:", { 
        title: newBoardTitle, 
        description: newBoardDescription,
        userId: routeUserId 
      });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Close modal and reset form
      setShowCreateModal(false);
      setNewBoardTitle("");
      setNewBoardDescription("");
      
      // Refresh dashboards list
      // In the future, this will call the actual API
      alert("Tablero creado exitosamente (funcionalidad pendiente)");
      
    } catch (error) {
      console.error("Error creating board:", error);
      alert("Error al crear el tablero");
    } finally {
      setCreating(false);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setNewBoardTitle("");
    setNewBoardDescription("");
  };

  return (
    <>
      {isLoggedIn ? <TopBarLogin /> : <TopBarNoLogin />}

      <div className="dashboards-page">
        {/* Encabezado azul */}
        <div className="dashboards-header">
          <Container>
            <h2 className="page-title text-center">
              {routeUserId ? (
                <>
                  Tableros del usuario{" "}
                  <span className="username">{dashboardOwnerName || "Cargando..."}</span>
                </>
              ) : (
                "Tableros públicos"
              )}
            </h2>
          </Container>
        </div>

        <Container className="dashboards-container">
          {loading ? (
            <div className="text-center mt-5">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : dashboards.length === 0 ? (
            <div className="text-center mt-5">
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</div>
              <h4 className="text-muted">No hay tableros creados aún</h4>
              <p className="text-muted">
                {isOwnDashboards 
                  ? "Comienza creando tu primer tablero usando el botón de abajo." 
                  : "Este usuario aún no ha creado ningún tablero."}
              </p>
            </div>
          ) : (
            <Row className="g-4 justify-content-center">
              {dashboards.map((dashboard, index) => (
                <Col xs={12} sm={6} md={4} lg={3} key={index}>
                  <Card className="dashboard-card">
                    <Card.Body>
                      <div className="placeholder-icon">📊</div>
                      <Card.Title>{dashboard.title}</Card.Title>
                      <Card.Text>{dashboard.description}</Card.Text>
                      <Button variant="primary" size="sm">
                        Ver detalles
                      </Button>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {/* Show "Create board" button only if viewing own dashboards */}
          {isOwnDashboards && (
            <div className="text-center mt-4">
              <Button
                variant="success"
                size="lg"
                onClick={() => setShowCreateModal(true)}
              >
                + Crear tablero
              </Button>
            </div>
          )}

          {isLoggedIn && (
            <div className="text-center mt-5">
              <Button
                variant="outline-primary"
                href={`/profile/${routeUserId}`}
                className="go-profile-btn"
              >
                Ir al perfil del usuario
              </Button>
            </div>
          )}
        </Container>
      </div>

      {/* Create Board Modal */}
      <Modal show={showCreateModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Crear nuevo tablero</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Nombre del tablero *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ej: Mi proyecto personal"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Descripción (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Describe de qué trata este tablero..."
                value={newBoardDescription}
                onChange={(e) => setNewBoardDescription(e.target.value)}
                maxLength={500}
              />
              <Form.Text className="text-muted">
                {newBoardDescription.length}/500 caracteres
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal} disabled={creating}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateBoard}
            disabled={creating || !newBoardTitle.trim()}
          >
            {creating ? "Creando..." : "Crear tablero"}
          </Button>
        </Modal.Footer>
      </Modal>

      <FooterBar />
    </>
  );
};

export default DashboardsPage;
