package com.amarvote.amarvote;

import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "RAG_SERVICE_URL=http://localhost:5001" // mock URL
})
class AmarvoteApplicationTests {
    // @Test
    // void contextLoads() {
        // Just verify Spring context loads
        // forcing deployment
        
    // }    
}