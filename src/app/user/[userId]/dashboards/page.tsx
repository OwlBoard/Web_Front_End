'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Container, Row, Col, Card, Button, Spinner, Modal, Form } from 'react-bootstrap';
import TopBarLogin from '@/components/TopBarLogin';
import TopBarNoLogin from '@/components/TopBarNoLogin';
import FooterBar from '@/components/FooterBar';
import '@/styles/UserDashboardsPage.css';

// Force dynamic rendering (no static generation at build time)
export const dynamic = 'force-dynamic';

interface Dashboard {
  id: number | string;
  title: string;
  description: string;
}

export default function UserDashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardOwnerName, setDashboardOwnerName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const params = useParams();
  const router = useRouter();
  
  const routeUserId = params.userId as string;
  const loggedInUserId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;
  const isLoggedIn = !!loggedInUserId;
  const isOwnDashboards = isLoggedIn && loggedInUserId === routeUserId;

  useEffect(() => {
    const fetchDashboards = async () => {
      if (!routeUserId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user info to get the owner's name
        const apiUrl = process.env.NEXT_PUBLIC_USER_SERVICE_URL || 'http://localhost:8000/api/users';
        try {
          const userResponse = await fetch(`${apiUrl}/${routeUserId}`);
          if (userResponse.ok) {
            const contentType = userResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const userData = await userResponse.json();
              setDashboardOwnerName(userData.full_name || userData.email || 'Usuario');
            }
          }
        } catch (userError) {
          console.error('Error fetching user info:', userError);
          setDashboardOwnerName('Usuario');
        }

        // Fetch dashboards
        const response = await fetch(`${apiUrl}/${routeUserId}/dashboards`);
        if (!response.ok) throw new Error('Error al cargar los dashboards');
        const data = await response.json();

        setDashboards(data);
      } catch (error) {
        console.error('Error:', error);
        setDashboardOwnerName('Usuario');
        setDashboards([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboards();
  }, [routeUserId]);

  const handleCreateBoard = async () => {
    if (!newBoardTitle.trim()) {
      alert('Por favor ingresa un nombre para el tablero');
      return;
    }

    setCreating(true);
    const apiUrl = process.env.NEXT_PUBLIC_USER_SERVICE_URL || 'http://localhost:8000/api/users';
    try {
      const response = await fetch(`${apiUrl}/${routeUserId}/dashboards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newBoardTitle,
          description: newBoardDescription,
        }),
      });

      if (!response.ok) throw new Error('Error al crear el tablero');

      const newDashboard = await response.json();
      setDashboards([...dashboards, newDashboard]);
      setShowCreateModal(false);
      setNewBoardTitle('');
      setNewBoardDescription('');
    } catch (error) {
      console.error('Error creating board:', error);
      alert('Error al crear el tablero');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <>
        {isLoggedIn ? <TopBarLogin /> : <TopBarNoLogin />}
        <div className="text-center mt-5 pt-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Cargando tableros...</p>
        </div>
      </>
    );
  }

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
                  Tableros del usuario{' '}
                  <span className="username">{dashboardOwnerName || 'Cargando...'}</span>
                </>
              ) : (
                'Tableros públicos'
              )}
            </h2>
          </Container>
        </div>

        <Container className="dashboards-container">
          {dashboards.length === 0 ? (
            <div className="text-center mt-5">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              <h4 className="text-light">No hay tableros creados aún</h4>
              <p className="text-light">
                {isOwnDashboards
                  ? 'Comienza creando tu primer tablero usando el botón de abajo.'
                  : 'Este usuario aún no ha creado ningún tablero.'}
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
                      <Card.Text>{dashboard.description || 'Sin descripción'}</Card.Text>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push(`/board/${dashboard.id}`)}
                      >
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
                onClick={() => router.push(`/profile/${routeUserId}`)}
                className="go-profile-btn"
              >
                Ir al perfil del usuario
              </Button>
            </div>
          )}
        </Container>
      </div>

      {/* Create Board Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered>
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
          <Button
            variant="secondary"
            onClick={() => setShowCreateModal(false)}
            disabled={creating}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateBoard}
            disabled={creating || !newBoardTitle.trim()}
          >
            {creating ? 'Creando...' : 'Crear tablero'}
          </Button>
        </Modal.Footer>
      </Modal>

      <FooterBar />
    </>
  );
}
