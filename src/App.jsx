import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { Rocket, Globe2, Magnet, PlusCircle, Eraser } from 'lucide-react';

const App = () => {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const mouseConstraintRef = useRef(null);

  // States mapping directly to user requested buttons
  const [activeTool, setActiveTool] = useState('create'); // 'create', 'delete'
  const [gravityMode, setGravityMode] = useState('earth'); // 'zero', 'earth'
  const [magnetActive, setMagnetActive] = useState(false);

  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    // Engine setup
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 } // Earth gravity by default
    });
    engineRef.current = engine;
    const world = engine.world;

    // Render setup
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio
      }
    });
    renderRef.current = render;

    // Colors for random shapes
    const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#10b981'];

    // Create boundaries (walls)
    const walls = [
      Matter.Bodies.rectangle(window.innerWidth / 2, -1500, window.innerWidth * 2, 3000, { isStatic: true, render: { visible: false } }), // Top (very high)
      Matter.Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 50, window.innerWidth * 2, 100, {
        isStatic: true,
        render: { fillStyle: 'rgba(255, 255, 255, 0.05)' }
      }), // Bottom
      Matter.Bodies.rectangle(-25, window.innerHeight / 2, 50, window.innerHeight * 2, { isStatic: true, render: { visible: false } }), // Left
      Matter.Bodies.rectangle(window.innerWidth + 25, window.innerHeight / 2, 50, window.innerHeight * 2, { isStatic: true, render: { visible: false } }) // Right
    ];

    Matter.World.add(world, walls);

    // Mouse control
    const mouse = Matter.Mouse.create(render.canvas);

    // Fix for Mac Retina / High DPI displays where mouse coordinates get offset
    mouse.pixelRatio = window.devicePixelRatio;

    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    });
    mouseConstraintRef.current = mouseConstraint;

    Matter.World.add(world, mouseConstraint);
    render.mouse = mouse;

    // Canvas Event Listener for accurate screen positions
    const handleCanvasMousedown = (e) => {
      const currentTool = document.body.getAttribute('data-tool');
      const currentGravity = document.body.getAttribute('data-gravity');

      // Get the EXACT click coordinates on the screen
      const x = e.clientX;
      const y = e.clientY;

      if (currentTool === 'create') {
        // --- CREATE SHAPE EXACTLY AT MOUSE X/Y ---
        const radius = Math.random() * 25 + 15;
        const type = Math.random();
        const color = colors[Math.floor(Math.random() * colors.length)];

        let body;
        const options = {
          restitution: 0.8,
          friction: 0.005,
          render: {
            fillStyle: color,
            strokeStyle: 'rgba(255, 255, 255, 0.4)',
            lineWidth: 2
          }
        };

        if (type > 0.6) {
          body = Matter.Bodies.circle(x, y, radius, options);
        } else if (type > 0.3) {
          body = Matter.Bodies.rectangle(x, y, radius * 2, radius * 2, { ...options, chamfer: { radius: 8 } });
        } else {
          const sides = Math.floor(Math.random() * 4) + 3;
          body = Matter.Bodies.polygon(x, y, sides, radius * 1.3, options);
        }

        if (currentGravity === 'zero') {
          body.frictionAir = 0.05;
        }

        Matter.World.add(world, body);

      } else if (currentTool === 'delete') {
        // --- DELETE SHAPE ---
        const allBodies = Matter.Composite.allBodies(world);
        const dynamicBodies = allBodies.filter(b => !b.isStatic);

        // Find if any dynamic body contains the clicked point based on exact physics scale
        const mousePoint = { x: e.clientX, y: e.clientY };
        const clickedBodies = Matter.Query.point(dynamicBodies, mousePoint);

        if (clickedBodies.length > 0) {
          Matter.World.remove(world, clickedBodies[0]);
        }
      }
    };

    render.canvas.addEventListener('mousedown', handleCanvasMousedown);

    // Track mouse movement for magnet
    render.canvas.addEventListener('mousemove', (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    });

    // Start engine & render
    Matter.Runner.run(Matter.Runner.create(), engine);
    Matter.Render.run(render);

    // Resize handler
    const handleResize = () => {
      render.canvas.width = window.innerWidth;
      render.canvas.height = window.innerHeight;

      Matter.Body.setPosition(walls[1], { x: window.innerWidth / 2, y: window.innerHeight + 50 }); // Bottom
      Matter.Body.setPosition(walls[3], { x: window.innerWidth + 25, y: window.innerHeight / 2 }); // Right
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (render.canvas) {
        render.canvas.removeEventListener('mousedown', handleCanvasMousedown);
      }
      Matter.Render.stop(render);
      Matter.Engine.clear(engine);
      if (render.canvas) {
        render.canvas.remove();
      }
    };
  }, []); // Run once on mount

  // Sync state to DOM attributes for Matter.js events scope
  useEffect(() => {
    document.body.setAttribute('data-tool', activeTool);
  }, [activeTool]);

  useEffect(() => {
    document.body.setAttribute('data-gravity', gravityMode);
  }, [gravityMode]);

  // Update Magnet Physics on every tick
  useEffect(() => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    // Magnet Force Event
    const applyMagnetForce = () => {
      if (!magnetActive) return;

      const bodies = Matter.Composite.allBodies(engine.world);
      bodies.forEach(body => {
        if (!body.isStatic) {
          const dx = mousePos.current.x - body.position.x;
          const dy = mousePos.current.y - body.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Magnet range (0 to 1200px radius - significantly larger range)
          if (distance < 1200 && distance > 10) {
            // Apply a significantly stronger force
            // Adjusted multiplier from 0.001 to 0.005 and distance scaling
            const forceMagnitude = (0.005 * body.mass) / (distance * 0.02);
            Matter.Body.applyForce(body, body.position, {
              x: (dx / distance) * forceMagnitude,
              y: (dy / distance) * forceMagnitude
            });
          }
        }
      });
    };

    Matter.Events.on(engine, 'beforeUpdate', applyMagnetForce);
    return () => Matter.Events.off(engine, 'beforeUpdate', applyMagnetForce);
  }, [magnetActive]);

  // Update Gravity Physics
  useEffect(() => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    switch (gravityMode) {
      case 'zero':
        engine.gravity.scale = 0;
        // Make shapes float gracefully
        Matter.Composite.allBodies(engine.world).forEach(body => {
          if (!body.isStatic) {
            body.frictionAir = 0.05;
          }
        });
        break;
      case 'earth':
      default:
        engine.gravity.scale = 0.001;
        // Normal air resistance
        Matter.Composite.allBodies(engine.world).forEach(body => {
          if (!body.isStatic) {
            body.frictionAir = 0.001;
          }
        });
        break;
    }
  }, [gravityMode]);

  // Cursor style logic based on tool
  const getCursorStyle = () => {
    if (activeTool === 'create') return 'crosshair';
    if (activeTool === 'delete') return 'cell'; // 'cell' looks like a target/eraser
    return 'default';
  };

  return (
    <>
      <div className="app-header">
        <h1 className="app-title">Gravity Sandbox</h1>
        <p className="app-subtitle">
          {activeTool === 'create' ? '화면을 클릭하여 도형을 생성하세요.' : '도형을 클릭하여 지우세요.'}
        </p>
      </div>

      <div
        ref={sceneRef}
        className="canvas-container"
        style={{ cursor: getCursorStyle() }}
      />

      {/* 5 Controls exactly as requested */}
      <div className="controls-panel">

        {/* 생성 / 삭제 버튼 */}
        <div className="controls-group">
          <span className="controls-title">마우스 동작</span>
          <div className="buttons-row">
            <button
              className={`control-btn ${activeTool === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTool('create')}
            >
              <PlusCircle size={18} />
              1. 도형 생성
            </button>
            <button
              className={`control-btn ${activeTool === 'delete' ? 'active' : ''}`}
              onClick={() => setActiveTool('delete')}
            >
              <Eraser size={18} />
              2. 도형 삭제
            </button>
          </div>
        </div>

        {/* 자석 기능 버튼 */}
        <div className="controls-group">
          <span className="controls-title">특수 능력</span>
          <div className="buttons-row">
            <button
              className={`control-btn magnet-btn ${magnetActive ? 'active' : ''}`}
              onClick={() => setMagnetActive(!magnetActive)}
            >
              <Magnet size={18} />
              3. 자석 {magnetActive ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* 중력 버튼 */}
        <div className="controls-group" style={{ borderRight: 'none' }}>
          <span className="controls-title">중력 환경</span>
          <div className="buttons-row">
            <button
              className={`control-btn ${gravityMode === 'zero' ? 'active' : ''}`}
              onClick={() => setGravityMode('zero')}
            >
              <Rocket size={18} />
              4. 중력 0
            </button>
            <button
              className={`control-btn ${gravityMode === 'earth' ? 'active' : ''}`}
              onClick={() => setGravityMode('earth')}
            >
              <Globe2 size={18} />
              5. 중력 생성
            </button>
          </div>
        </div>

      </div>
    </>
  );
};

export default App;
